#!/usr/bin/env python3
"""
Hermes Dashboard API Server
Pure Python stdlib HTTP server with async SQLite database support.
"""

import asyncio
import json
import os
import re
import sys
import time
import mimetypes
import subprocess
from datetime import datetime, timedelta
from enum import Enum
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path
import threading
import signal

# Try to import aiosqlite, fall back to sqlite3 if not available
try:
    import aiosqlite
    HAS_AIOSQLITE = True
except ImportError:
    HAS_AIOSQLITE = False
    import sqlite3

try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False

# Configuration
# Determine base directory relative to this script's location
_SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = _SCRIPT_DIR.parent
STATIC_DIR = BASE_DIR / "static"
SERVER_HOST = os.environ.get("HERMES_HOST", "0.0.0.0")
# Deployment platforms (Railway, Render, Fly.io, etc.) set PORT; fall back to HERMES_PORT or 8080
SERVER_PORT = int(os.environ.get("PORT") or os.environ.get("HERMES_PORT", "8080"))
DB_PATH = BASE_DIR / "server" / "dashboard.db"
SCHEMA_PATH = BASE_DIR / "server" / "schema.sql"

# CORS Headers
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
CORS_METHODS = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
CORS_HEADERS = ["Content-Type", "Authorization", "X-Requested-With"]

# ============================================================================
# Database Module
# ============================================================================

class Database:
    """Async SQLite database wrapper using aiosqlite or sync sqlite3 fallback."""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._sync_db = None
        self._async_db = None
        self._use_async = HAS_AIOSQLITE
        self._loop = None
    
    async def initialize(self):
        """Initialize database connection and create tables."""
        # Ensure database directory exists
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        
        if self._use_async:
            self._async_db = await aiosqlite.connect(str(DB_PATH))
            self._async_db.row_factory = aiosqlite.Row
            await self._create_tables(self._async_db)
        else:
            self._sync_db = sqlite3.connect(str(DB_PATH))
            self._sync_db.row_factory = sqlite3.Row
            self._create_tables_sync(self._sync_db)
    
    async def _create_tables(self, db):
        """Create tables from schema file (async version)."""
        if SCHEMA_PATH.exists():
            with open(SCHEMA_PATH, 'r') as f:
                schema = f.read()
            await db.executescript(schema)
            await db.commit()
    
    def _create_tables_sync(self, db):
        """Create tables from schema file (sync version)."""
        if SCHEMA_PATH.exists():
            with open(SCHEMA_PATH, 'r') as f:
                schema = f.read()
            db.executescript(schema)
            db.commit()
    
    async def fetch_one(self, query: str, params: Tuple = ()) -> Optional[Dict]:
        """Execute query and fetch one result."""
        if self._use_async and self._async_db:
            async with self._async_db.execute(query, params) as cursor:
                row = await cursor.fetchone()
                return dict(row) if row else None
        else:
            cursor = self._sync_db.execute(query, params)
            row = cursor.fetchone()
            return dict(row) if row else None
    
    async def fetch_all(self, query: str, params: Tuple = ()) -> List[Dict]:
        """Execute query and fetch all results."""
        if self._use_async and self._async_db:
            async with self._async_db.execute(query, params) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]
        else:
            cursor = self._sync_db.execute(query, params)
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    
    async def execute(self, query: str, params: Tuple = ()) -> int:
        """Execute query and return last row id."""
        if self._use_async and self._async_db:
            cursor = await self._async_db.execute(query, params)
            await self._async_db.commit()
            return cursor.lastrowid or 0
        else:
            cursor = self._sync_db.execute(query, params)
            self._sync_db.commit()
            return cursor.lastrowid or 0
    
    async def execute_many(self, query: str, params_list: List[Tuple]) -> int:
        """Execute query with multiple parameter sets."""
        if self._use_async and self._async_db:
            await self._async_db.executemany(query, params_list)
            await self._async_db.commit()
            return len(params_list)
        else:
            self._sync_db.executemany(query, params_list)
            self._sync_db.commit()
            return len(params_list)
    
    async def close(self):
        """Close database connection."""
        if self._use_async and self._async_db:
            await self._async_db.close()
        elif self._sync_db:
            self._sync_db.close()


# Global database instance
db = Database()


# ============================================================================
# Process Management Module
# ============================================================================

class ProcessManager:
    """Manages agent processes and system resource monitoring."""
    
    def __init__(self):
        self._agents: Dict[int, Dict[str, Any]] = {}
        self._heartbeats: Dict[int, datetime] = {}
        self._lock = asyncio.Lock()
    
    async def register_agent(self, agent_id: int, process_info: Dict[str, Any]) -> None:
        """Register a new agent process."""
        async with self._lock:
            self._agents[agent_id] = {
                "pid": process_info.get("pid"),
                "session_name": process_info.get("session_name"),
                "started_at": datetime.now(),
                "status": "running",
                "last_heartbeat": datetime.now(),
            }
            self._heartbeats[agent_id] = datetime.now()
    
    async def unregister_agent(self, agent_id: int) -> None:
        """Unregister an agent process."""
        async with self._lock:
            self._agents.pop(agent_id, None)
            self._heartbeats.pop(agent_id, None)
    
    async def update_heartbeat(self, agent_id: int) -> None:
        """Update agent heartbeat timestamp."""
        async with self._lock:
            self._heartbeats[agent_id] = datetime.now()
            if agent_id in self._agents:
                self._agents[agent_id]["last_heartbeat"] = datetime.now()
    
    async def get_heartbeat_status(self, agent_id: int) -> Optional[Dict[str, Any]]:
        """Get heartbeat status for an agent."""
        async with self._lock:
            if agent_id not in self._heartbeats:
                return None
            last_heartbeat = self._heartbeats[agent_id]
            is_alive = (datetime.now() - last_heartbeat) < timedelta(seconds=30)
            return {
                "agent_id": agent_id,
                "last_heartbeat": last_heartbeat.isoformat(),
                "is_alive": is_alive,
                "seconds_since_heartbeat": (datetime.now() - last_heartbeat).total_seconds(),
            }
    
    def get_tmux_sessions(self) -> List[Dict[str, Any]]:
        """Get list of tmux sessions."""
        try:
            result = subprocess.run(
                ["tmux", "list-sessions", "-F", "#{session_name}:{session_created}:{session_attached}:{session_windows}:{session_panes}"],
                capture_output=True,
                text=True,
                timeout=5
            )
            sessions = []
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    if line:
                        parts = line.split(":")
                        if len(parts) >= 5:
                            sessions.append({
                                "name": parts[0],
                                "created": int(parts[1]),
                                "attached": parts[2] == "1",
                                "windows": int(parts[3]),
                                "panes": int(parts[4]),
                            })
            return sessions
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            return []
    
    def get_tmux_session_info(self, session_name: str) -> Optional[Dict[str, Any]]:
        """Get detailed info about a specific tmux session."""
        try:
            # Get session info
            result = subprocess.run(
                ["tmux", "list-windows", "-t", session_name, "-F", "#{window_index}:{window_name}:{window_active}:{window_panes}"],
                capture_output=True,
                text=True,
                timeout=5
            )
            windows = []
            if result.returncode == 0:
                for line in result.stdout.strip().split("\n"):
                    if line:
                        parts = line.split(":")
                        if len(parts) >= 4:
                            windows.append({
                                "index": int(parts[0]),
                                "name": parts[1],
                                "active": parts[2] == "1",
                                "panes": int(parts[3]),
                            })
            
            # Get session creation time
            result = subprocess.run(
                ["tmux", "display-message", "-t", session_name, "-p", "#{session_created}"],
                capture_output=True,
                text=True,
                timeout=5
            )
            created = int(result.stdout.strip()) if result.returncode == 0 else 0
            
            return {
                "name": session_name,
                "created": created,
                "windows": windows,
            }
        except (subprocess.TimeoutExpired, FileNotFoundError, subprocess.SubprocessError):
            return None
    
    def get_process_resources(self, pid: int) -> Optional[Dict[str, Any]]:
        """Get CPU and memory usage for a process using psutil."""
        if not HAS_PSUTIL:
            return self._get_process_resources_procfs(pid)
        
        try:
            process = psutil.Process(pid)
            with process.oneshot():
                return {
                    "pid": pid,
                    "cpu_percent": process.cpu_percent(interval=0.1),
                    "memory_mb": process.memory_info().rss / (1024 * 1024),
                    "memory_percent": process.memory_percent(),
                    "num_threads": process.num_threads(),
                    "status": process.status(),
                    "create_time": datetime.fromtimestamp(process.create_time()).isoformat(),
                }
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            return None
    
    def _get_process_resources_procfs(self, pid: int) -> Optional[Dict[str, Any]]:
        """Get process resources from /proc filesystem (fallback when psutil unavailable)."""
        try:
            stat_path = f"/proc/{pid}/stat"
            status_path = f"/proc/{pid}/status"
            
            with open(stat_path, 'r') as f:
                stat = f.read().split()
            
            with open(status_path, 'r') as f:
                status = f.read()
            
            # Parse memory from status
            mem_info = {}
            for line in status.split("\n"):
                if ":" in line:
                    key, val = line.split(":", 1)
                    mem_info[key.strip()] = val.strip()
            
            utime = int(stat[13])
            stime = int(stat[14])
            clock_ticks = os.sysconf(os.sysconf_names["SC_CLK_TCK"])
            
            return {
                "pid": pid,
                "cpu_percent": (utime + stime) * 100.0 / clock_ticks,
                "memory_mb": int(mem_info.get("VmRSS", "0 kB").split()[0]) / 1024,
                "memory_percent": 0.0,
                "num_threads": int(stat[19]),
                "status": stat[2],
                "create_time": datetime.fromtimestamp(
                    int(stat[21]) / clock_ticks
                ).isoformat() if len(stat) > 21 else None,
            }
        except (FileNotFoundError, PermissionError, IndexError):
            return None
    
    def get_system_resources(self) -> Dict[str, Any]:
        """Get overall system CPU and memory usage."""
        if HAS_PSUTIL:
            return {
                "cpu_percent": psutil.cpu_percent(interval=0.1),
                "cpu_count": psutil.cpu_count(),
                "memory_total_mb": psutil.virtual_memory().total / (1024 * 1024),
                "memory_available_mb": psutil.virtual_memory().available / (1024 * 1024),
                "memory_percent": psutil.virtual_memory().percent,
            }
        else:
            # Fallback using /proc/meminfo
            try:
                with open("/proc/meminfo", 'r') as f:
                    meminfo = {}
                    for line in f:
                        parts = line.split()
                        if len(parts) >= 2:
                            meminfo[parts[0]] = int(parts[1])
                
                total = meminfo.get("MemTotal", 0) / 1024
                available = meminfo.get("MemAvailable", 0) / 1024
                
                return {
                    "cpu_percent": 0.0,
                    "cpu_count": os.cpu_count() or 1,
                    "memory_total_mb": total,
                    "memory_available_mb": available,
                    "memory_percent": ((total - available) / total * 100) if total > 0 else 0,
                }
            except (FileNotFoundError, PermissionError):
                return {
                    "cpu_percent": 0.0,
                    "cpu_count": os.cpu_count() or 1,
                    "memory_total_mb": 0,
                    "memory_available_mb": 0,
                    "memory_percent": 0,
                }
    
    async def get_agent_resources(self, agent_id: int) -> Optional[Dict[str, Any]]:
        """Get resources for a registered agent."""
        async with self._lock:
            if agent_id not in self._agents:
                return None
            agent = self._agents[agent_id]
        
        pid = agent.get("pid")
        if not pid:
            return {
                "agent_id": agent_id,
                "status": agent.get("status"),
                "session_name": agent.get("session_name"),
                "process": None,
                "heartbeat": await self.get_heartbeat_status(agent_id),
            }
        
        process_info = self.get_process_resources(pid)
        heartbeat = await self.get_heartbeat_status(agent_id)
        
        return {
            "agent_id": agent_id,
            "status": agent.get("status"),
            "session_name": agent.get("session_name"),
            "started_at": agent.get("started_at").isoformat() if agent.get("started_at") else None,
            "process": process_info,
            "heartbeat": heartbeat,
            "system": self.get_system_resources(),
        }
    
    def get_all_agents_status(self) -> List[Dict[str, Any]]:
        """Get status of all registered agents."""
        result = []
        for agent_id, agent in self._agents.items():
            heartbeat = self._heartbeats.get(agent_id)
            is_alive = (datetime.now() - heartbeat) < timedelta(seconds=30) if heartbeat else False
            result.append({
                "agent_id": agent_id,
                "pid": agent.get("pid"),
                "session_name": agent.get("session_name"),
                "status": agent.get("status"),
                "started_at": agent.get("started_at").isoformat() if agent.get("started_at") else None,
                "is_alive": is_alive,
            })
        return result


# Global process manager instance
process_manager = ProcessManager()


# ============================================================================
# Request/Response Helpers
# ============================================================================

def json_response(data: Any, status: int = 200) -> Tuple[bytes, int]:
    """Create a JSON response."""
    body = json.dumps(data, default=str).encode("utf-8")
    return body, status


def error_response(message: str, status: int = 400, error_code: str = None) -> Tuple[bytes, int]:
    """Create an error JSON response."""
    data = {"error": message, "status": status}
    if error_code:
        data["code"] = error_code
    return json_response(data, status)


def parse_json_body(body: bytes) -> Optional[Dict[str, Any]]:
    """Parse JSON from request body."""
    if not body:
        return None
    try:
        return json.loads(body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


def parse_path_params(path: str) -> Tuple[str, Dict[str, str]]:
    """Parse path and extract parameters from URL.
    
    Returns:
        Tuple of (path_without_api_prefix, {param_name: param_value})
    """
    # Remove /api prefix
    if path.startswith("/api"):
        path = path[4:]
    
    if not path.startswith("/"):
        path = "/" + path
    
    return path, {}


# ============================================================================
# API Endpoint Handlers
# ============================================================================

class APIHandler:
    """Handles all API endpoint logic."""
    
    # ------------------------------------------------------------------
    # Orgs Endpoints
    # ------------------------------------------------------------------
    
    @staticmethod
    async def get_orgs() -> Tuple[bytes, int]:
        """GET /api/orgs - List all organizations."""
        try:
            rows = await db.fetch_all(
                "SELECT id, name, description, is_active, created_at, updated_at FROM orgs ORDER BY name"
            )
            return json_response({"orgs": rows, "count": len(rows)})
        except Exception as e:
            return error_response(f"Failed to fetch organizations: {str(e)}", 500)
    
    @staticmethod
    async def create_org(data: Dict[str, Any]) -> Tuple[bytes, int]:
        """POST /api/orgs - Create a new organization."""
        name = data.get("name")
        if not name:
            return error_response("Organization name is required", 400)
        
        description = data.get("description", "")
        api_key = data.get("api_key")
        
        try:
            org_id = await db.execute(
                "INSERT INTO orgs (name, description, api_key) VALUES (?, ?, ?)",
                (name, description, api_key)
            )
            org = await db.fetch_one(
                "SELECT id, name, description, is_active, created_at, updated_at FROM orgs WHERE id = ?",
                (org_id,)
            )
            return json_response(org, 201)
        except Exception as e:
            if "UNIQUE constraint" in str(e):
                return error_response(f"Organization '{name}' already exists", 409)
            return error_response(f"Failed to create organization: {str(e)}", 500)
    
    # ------------------------------------------------------------------
    # Agents Endpoints
    # ------------------------------------------------------------------
    
    @staticmethod
    async def get_agents(org_id: int = None) -> Tuple[bytes, int]:
        """GET /api/agents - List all agents, optionally filtered by org."""
        try:
            if org_id:
                rows = await db.fetch_all(
                    """SELECT id, org_id, name, role, mission, description, tmux_session,
                       status, cpu_percent, memory_mb, uptime_seconds, last_heartbeat,
                       model, provider, avatar_seed, avatar_style, system_prompt,
                       created_at, updated_at
                       FROM agents WHERE org_id = ? ORDER BY name""",
                    (org_id,)
                )
            else:
                rows = await db.fetch_all(
                    """SELECT id, org_id, name, role, mission, description, tmux_session,
                       status, cpu_percent, memory_mb, uptime_seconds, last_heartbeat,
                       model, provider, avatar_seed, avatar_style, system_prompt,
                       created_at, updated_at
                       FROM agents ORDER BY name"""
                )

            # Enrich with process status
            agents_status = {a["agent_id"]: a for a in process_manager.get_all_agents_status()}
            for agent in rows:
                if agent["id"] in agents_status:
                    agent["process_status"] = agents_status[agent["id"]]
                else:
                    agent["process_status"] = None

            return json_response({"agents": rows, "count": len(rows)})
        except Exception as e:
            return error_response(f"Failed to fetch agents: {str(e)}", 500)
    
    @staticmethod
    async def get_agent(agent_id: int) -> Tuple[bytes, int]:
        """GET /api/agents/:id - Get a single agent."""
        try:
            agent = await db.fetch_one(
                """SELECT id, org_id, name, role, mission, description, tmux_session,
                   status, cpu_percent, memory_mb, uptime_seconds, last_heartbeat,
                   model, provider, avatar_seed, avatar_style, system_prompt,
                   created_at, updated_at
                   FROM agents WHERE id = ?""",
                (agent_id,)
            )
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)

            # Get process status
            agent["process_status"] = None
            for a in process_manager.get_all_agents_status():
                if a["agent_id"] == agent_id:
                    agent["process_status"] = a
                    break

            return json_response(agent)
        except Exception as e:
            return error_response(f"Failed to fetch agent: {str(e)}", 500)

    @staticmethod
    async def create_agent(data: Dict[str, Any]) -> Tuple[bytes, int]:
        """POST /api/agents - Create a new agent."""
        required = ["name", "org_id"]
        for field in required:
            if field not in data:
                return error_response(f"Field '{field}' is required", 400)

        try:
            # Verify org exists
            org = await db.fetch_one("SELECT id FROM orgs WHERE id = ?", (data["org_id"],))
            if not org:
                return error_response(f"Organization {data['org_id']} not found", 404)

            agent_id = await db.execute(
                """INSERT INTO agents (org_id, name, role, mission, description, tmux_session,
                   status, model, provider, avatar_seed, avatar_style, system_prompt)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    data["org_id"],
                    data["name"],
                    data.get("role", ""),
                    data.get("mission", ""),
                    data.get("description", ""),
                    data.get("tmux_session", ""),
                    data.get("status", "idle"),
                    data.get("model", "minimax/minimax-m2.7"),
                    data.get("provider", "openrouter"),
                    data.get("avatar_seed", data["name"]),
                    data.get("avatar_style", "bottts"),
                    data.get("system_prompt", ""),
                )
            )

            agent = await db.fetch_one(
                """SELECT id, org_id, name, role, mission, description, tmux_session,
                   status, cpu_percent, memory_mb, uptime_seconds, last_heartbeat,
                   model, provider, avatar_seed, avatar_style, system_prompt,
                   created_at, updated_at
                   FROM agents WHERE id = ?""",
                (agent_id,)
            )
            return json_response(agent, 201)
        except Exception as e:
            return error_response(f"Failed to create agent: {str(e)}", 500)

    @staticmethod
    async def update_agent(agent_id: int, data: Dict[str, Any]) -> Tuple[bytes, int]:
        """PUT /api/agents/:id - Update an agent."""
        try:
            agent = await db.fetch_one("SELECT id FROM agents WHERE id = ?", (agent_id,))
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)

            # Build dynamic update query
            allowed_fields = ["name", "role", "mission", "description", "tmux_session",
                              "status", "model", "provider", "avatar_seed", "avatar_style",
                              "system_prompt", "cpu_percent", "memory_mb", "uptime_seconds",
                              "last_heartbeat"]
            updates = []
            values = []

            for field in allowed_fields:
                if field in data:
                    updates.append(f"{field} = ?")
                    values.append(data[field])

            if updates:
                values.append(agent_id)
                await db.execute(
                    f"UPDATE agents SET {', '.join(updates)} WHERE id = ?",
                    tuple(values)
                )

            updated_agent = await db.fetch_one(
                """SELECT id, org_id, name, role, mission, description, tmux_session,
                   status, cpu_percent, memory_mb, uptime_seconds, last_heartbeat,
                   model, provider, avatar_seed, avatar_style, system_prompt,
                   created_at, updated_at
                   FROM agents WHERE id = ?""",
                (agent_id,)
            )
            return json_response(updated_agent)
        except Exception as e:
            return error_response(f"Failed to update agent: {str(e)}", 500)
    
    @staticmethod
    async def delete_agent(agent_id: int) -> Tuple[bytes, int]:
        """DELETE /api/agents/:id - Delete an agent."""
        try:
            agent = await db.fetch_one("SELECT id FROM agents WHERE id = ?", (agent_id,))
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)
            
            # Unregister from process manager
            await process_manager.unregister_agent(agent_id)
            
            await db.execute("DELETE FROM agents WHERE id = ?", (agent_id,))
            return json_response({"message": f"Agent {agent_id} deleted successfully"})
        except Exception as e:
            return error_response(f"Failed to delete agent: {str(e)}", 500)
    
    # ------------------------------------------------------------------
    # Messages Endpoints
    # ------------------------------------------------------------------
    
    @staticmethod
    async def get_messages(agent_id: int, limit: int = 100, offset: int = 0) -> Tuple[bytes, int]:
        """GET /api/agents/:id/messages - Get messages for an agent."""
        try:
            # Verify agent exists
            agent = await db.fetch_one("SELECT id FROM agents WHERE id = ?", (agent_id,))
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)
            
            # Get conversation for this agent
            conv = await db.fetch_one(
                "SELECT id FROM conversations WHERE agent_id = ? ORDER BY created_at DESC LIMIT 1",
                (agent_id,)
            )
            
            if not conv:
                return json_response({"messages": [], "count": 0})
            
            messages = await db.fetch_all(
                """SELECT id, conversation_id, role, content, metadata, created_at
                   FROM messages WHERE conversation_id = ? AND is_deleted = 0
                   ORDER BY created_at ASC LIMIT ? OFFSET ?""",
                (conv["id"], limit, offset)
            )
            
            return json_response({"messages": messages, "count": len(messages)})
        except Exception as e:
            return error_response(f"Failed to fetch messages: {str(e)}", 500)
    
    @staticmethod
    async def create_message(agent_id: int, data: Dict[str, Any]) -> Tuple[bytes, int]:
        """POST /api/agents/:id/messages - Send a message to an agent."""
        content = data.get("content")
        if not content:
            return error_response("Message content is required", 400)
        
        role = data.get("role", "user")
        if role not in ("user", "assistant", "system", "tool"):
            return error_response("Invalid role. Must be: user, assistant, system, or tool", 400)
        
        try:
            # Verify agent exists and get org_id
            agent = await db.fetch_one("SELECT id, org_id FROM agents WHERE id = ?", (agent_id,))
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)
            
            # Get or create active conversation
            conv = await db.fetch_one(
                "SELECT id FROM conversations WHERE agent_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1",
                (agent_id,)
            )
            
            if not conv:
                conv_id = await db.execute(
                    "INSERT INTO conversations (org_id, agent_id, title) VALUES (?, ?, ?)",
                    (agent["org_id"], agent_id, "New Conversation")
                )
                conv = await db.fetch_one("SELECT id FROM conversations WHERE id = ?", (conv_id,))
            
            message_id = await db.execute(
                """INSERT INTO messages (conversation_id, role, content, metadata)
                   VALUES (?, ?, ?, ?)""",
                (conv["id"], role, content, json.dumps(data.get("metadata", {})))
            )
            
            message = await db.fetch_one(
                """SELECT id, conversation_id, role, content, metadata, created_at
                   FROM messages WHERE id = ?""",
                (message_id,)
            )
            
            return json_response(message, 201)
        except Exception as e:
            return error_response(f"Failed to create message: {str(e)}", 500)
    
    # ------------------------------------------------------------------
    # Resources Endpoint
    # ------------------------------------------------------------------
    
    @staticmethod
    async def get_resources(agent_id: int) -> Tuple[bytes, int]:
        """GET /api/agents/:id/resources - Get resource usage for an agent."""
        try:
            agent = await db.fetch_one("SELECT id FROM agents WHERE id = ?", (agent_id,))
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)
            
            resources = await process_manager.get_agent_resources(agent_id)
            if resources is None:
                return error_response(f"No resource data for agent {agent_id}", 404)
            
            # Get recent resource logs from database
            logs = await db.fetch_all(
                """SELECT id, resource_type, value, unit, metadata, logged_at
                   FROM resource_logs WHERE agent_id = ? 
                   ORDER BY logged_at DESC LIMIT 100""",
                (agent_id,)
            )
            
            resources["logs"] = logs
            return json_response(resources)
        except Exception as e:
            return error_response(f"Failed to fetch resources: {str(e)}", 500)
    
    # ------------------------------------------------------------------
    # Chat Endpoint
    # ------------------------------------------------------------------
    
    @staticmethod
    async def chat(agent_id: int, data: Dict[str, Any]) -> Tuple[bytes, int]:
        """POST /api/agents/:id/chat - Send a chat message and get response."""
        message = data.get("message") or data.get("content")
        if not message:
            return error_response("Message content is required", 400)
        
        try:
            agent = await db.fetch_one(
                "SELECT id, org_id, name, model, system_prompt FROM agents WHERE id = ?",
                (agent_id,)
            )
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)
            
            # Update heartbeat
            await process_manager.update_heartbeat(agent_id)
            
            # Create user message
            conv = await db.fetch_one(
                "SELECT id FROM conversations WHERE agent_id = ? AND is_active = 1 ORDER BY created_at DESC LIMIT 1",
                (agent_id,)
            )
            
            if not conv:
                conv_id = await db.execute(
                    "INSERT INTO conversations (org_id, agent_id, title) VALUES (?, ?, ?)",
                    (agent["org_id"], agent_id, "Chat Session")
                )
            else:
                conv_id = conv["id"]
            
            user_msg_id = await db.execute(
                "INSERT INTO messages (conversation_id, role, content) VALUES (?, 'user', ?)",
                (conv_id, message)
            )
            
            # Call the actual Hermes agent via non-interactive subprocess
            # This uses 'hermes chat -q' which outputs just the final response
            agent_model = agent.get("model") or "minimax/minimax-m2.7"
            agent_provider = agent.get("provider") or "openrouter"

            cmd = [
                "hermes", "chat",
                "-q", message,
                "-m", agent_model,
                "--provider", agent_provider,
                "-Q",          # quiet mode — suppress spinner + tool previews
                "--source", "dashboard",
            ]

            try:
                hermes_home = os.path.expanduser("~/.hermes")
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=120,
                    cwd=hermes_home,
                    env={**os.environ, "HERMES_HOME": hermes_home}
                )

                if result.returncode == 0:
                    raw_output = result.stdout
                    # Strip the ASCII box-drawing banner that hermes prints even in -Q mode
                    lines = raw_output.splitlines()
                    banner_chars = set("│╭╰╮╯─")
                    content_lines = []
                    started = False
                    for line in lines:
                        if not line.strip():
                            # Collect internal blanks but strip leading/trailing blanks
                            if started:
                                content_lines.append("")
                            continue
                        # Skip lines that start with box-drawing chars (banner frame lines)
                        if line.lstrip() and line.lstrip()[0] in banner_chars:
                            started = True  # we've exited the banner
                            continue
                        started = True
                        content_lines.append(line)

                    response_content = "\n".join(content_lines).strip()
                    if not response_content:
                        response_content = "(agent returned empty response)"
                else:
                    error_output = result.stderr.strip()
                    print(f"[Hermes chat error] agent_id={agent_id} stderr: {error_output}", flush=True)
                    response_content = f"Agent error: {error_output[:200]}" if error_output else "Agent failed to respond"

            except subprocess.TimeoutExpired:
                response_content = "Agent timed out after 120 seconds."
            except FileNotFoundError:
                response_content = "Hermes CLI not found. Is it installed and in PATH?"
            except Exception as e:
                response_content = f"Agent call failed: {str(e)[:200]}"
            
            assistant_msg_id = await db.execute(
                "INSERT INTO messages (conversation_id, role, content, metadata) VALUES (?, 'assistant', ?, ?)",
                (conv_id, response_content, json.dumps({"model": agent.get("model", "default")}))
            )
            
            user_msg = await db.fetch_one("SELECT * FROM messages WHERE id = ?", (user_msg_id,))
            assistant_msg = await db.fetch_one("SELECT * FROM messages WHERE id = ?", (assistant_msg_id,))
            
            return json_response({
                "conversation_id": conv_id,
                "user_message": user_msg,
                "assistant_message": assistant_msg,
            })
        except Exception as e:
            return error_response(f"Failed to process chat: {str(e)}", 500)
    
    # ------------------------------------------------------------------
    # Spawn Endpoint
    # ------------------------------------------------------------------
    
    @staticmethod
    async def spawn(agent_id: int, data: Dict[str, Any]) -> Tuple[bytes, int]:
        """POST /api/agents/:id/spawn - Spawn a new agent process."""
        try:
            agent = await db.fetch_one(
                "SELECT id, org_id, name, model, system_prompt, tmux_session from agents WHERE id = ?",
                (agent_id,)
            )
            if not agent:
                return error_response(f"Agent {agent_id} not found", 404)

            session_name = data.get("session_name") or f"hermes-agent-{agent_id}-{int(time.time())}"

            # Check if tmux is available
            tmux_check = subprocess.run(["which", "tmux"], capture_output=True)
            if tmux_check.returncode != 0:
                return error_response("tmux is not available on this system", 500)

            # Build command to run
            command = data.get("command") or "hermes chat -m minimax/minimax-m2.7"

            # Create new tmux session with the agent
            try:
                result = subprocess.run([
                    "tmux", "new-session", "-d", "-s", session_name,
                    f"{command}; read"  # keep session alive
                ], capture_output=True, text=True, timeout=10)

                if result.returncode != 0:
                    return error_response(f"Failed to spawn agent: {result.stderr}", 500)

                # Give it a moment to start
                await asyncio.sleep(0.5)

                # Get the PID of the tmux session process
                pid_result = subprocess.run(
                    ["pgrep", "-f", f"tmux.*session.*{session_name}"],
                    capture_output=True,
                    text=True
                )
                pid = None
                if pid_result.returncode == 0 and pid_result.stdout.strip():
                    try:
                        pid = int(pid_result.stdout.strip().split()[0])
                    except (ValueError, IndexError):
                        pass

                # Register with process manager
                await process_manager.register_agent(agent_id, {
                    "pid": pid,
                    "session_name": session_name,
                })

                # Update agent record with tmux session info and status
                await db.execute(
                    """UPDATE agents SET tmux_session = ?, status = 'running',
                       updated_at = CURRENT_TIMESTAMP WHERE id = ?""",
                    (session_name, agent_id)
                )

                session_info = process_manager.get_tmux_session_info(session_name)

                return json_response({
                    "message": "Agent spawned successfully",
                    "agent_id": agent_id,
                    "session_name": session_name,
                    "pid": pid,
                    "tmux_info": session_info,
                }, 201)

            except subprocess.TimeoutExpired:
                return error_response("Timeout while spawning agent", 500)
            except subprocess.SubprocessError as e:
                return error_response(f"Subprocess error: {str(e)}", 500)

        except Exception as e:
            return error_response(f"Failed to spawn agent: {str(e)}", 500)
    
    # ------------------------------------------------------------------
    # Settings Endpoints
    # ------------------------------------------------------------------
    
    @staticmethod
    async def get_settings(org_id: int = None) -> Tuple[bytes, int]:
        """GET /api/settings - Get all settings."""
        try:
            if org_id:
                rows = await db.fetch_all(
                    """SELECT id, org_id, setting_key, setting_value, value_type,
                       updated_at
                       FROM settings WHERE org_id = ? ORDER BY setting_key""",
                    (org_id,)
                )
            else:
                rows = await db.fetch_all(
                    """SELECT id, org_id, setting_key, setting_value, value_type,
                       updated_at
                       FROM settings ORDER BY setting_key"""
                )

            # Parse JSON values
            for row in rows:
                if row.get("value_type") == "json" and row.get("setting_value"):
                    try:
                        row["setting_value"] = json.loads(row["setting_value"])
                    except json.JSONDecodeError:
                        pass

            return json_response({"settings": rows, "count": len(rows)})
        except Exception as e:
            return error_response(f"Failed to fetch settings: {str(e)}", 500)

    @staticmethod
    async def update_settings(data: Dict[str, Any]) -> Tuple[bytes, int]:
        """PUT /api/settings - Update settings (upsert)."""
        try:
            results = []

            for key, value in data.items():
                if isinstance(value, dict):
                    value_str = json.dumps(value)
                    value_type = "json"
                elif isinstance(value, bool):
                    value_str = "true" if value else "false"
                    value_type = "boolean"
                elif isinstance(value, (int, float)):
                    value_str = str(value)
                    value_type = "number"
                else:
                    value_str = str(value)
                    value_type = "string"

                # Upsert
                existing = await db.fetch_one(
                    "SELECT id FROM settings WHERE setting_key = ? AND org_id = 1",
                    (key,)
                )

                if existing:
                    await db.execute(
                        "UPDATE settings SET setting_value = ?, value_type = ?, updated_at = CURRENT_TIMESTAMP WHERE setting_key = ? AND org_id = 1",
                        (value_str, value_type, key)
                    )
                    row = await db.fetch_one("SELECT * FROM settings WHERE setting_key = ? AND org_id = 1", (key,))
                else:
                    row_id = await db.execute(
                        "INSERT INTO settings (org_id, setting_key, setting_value, value_type) VALUES (1, ?, ?, ?)",
                        (key, value_str, value_type)
                    )
                    row = await db.fetch_one("SELECT * FROM settings WHERE id = ?", (row_id,))

                results.append(row)

            return json_response({"settings": results, "updated": len(results)})
        except Exception as e:
            return error_response(f"Failed to update settings: {str(e)}", 500)
    
    # ------------------------------------------------------------------
    # System Endpoints
    # ------------------------------------------------------------------
    
    @staticmethod
    async def get_system_status() -> Tuple[bytes, int]:
        """GET /api/system/status - Get overall system status."""
        try:
            return json_response({
                "status": "healthy",
                "timestamp": datetime.now().isoformat(),
                "agents": process_manager.get_all_agents_status(),
                "tmux_sessions": process_manager.get_tmux_sessions(),
                "system_resources": process_manager.get_system_resources(),
                "database_path": str(DB_PATH),
                "database_exists": DB_PATH.exists(),
            })
        except Exception as e:
            return error_response(f"Failed to get system status: {str(e)}", 500)


# ============================================================================
# HTTP Request Handler
# ============================================================================

class HermesDashboardHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Hermes Dashboard API."""
    
    # Class-level database reference
    db = db
    process_manager = process_manager
    
    def log_message(self, format, *args):
        """Override to provide better logging."""
        sys.stdout.write(f"[{datetime.now().isoformat()}] {args[0]}\n")
        sys.stdout.flush()
    
    def send_cors_headers(self):
        """Send CORS headers."""
        origin = self.headers.get("Origin", "*")
        if origin == "*":
            self.send_header("Access-Control-Allow-Origin", "*")
        else:
            self.send_header("Access-Control-Allow-Origin", origin)
        
        self.send_header("Access-Control-Allow-Methods", ", ".join(CORS_METHODS))
        self.send_header("Access-Control-Allow-Headers", ", ".join(CORS_HEADERS))
        self.send_header("Access-Control-Max-Age", "3600")
    
    def send_json_response(self, body: bytes, status: int = 200):
        """Send a JSON response with proper headers."""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.send_cors_headers()
        self.end_headers()
        self.wfile.write(body)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests."""
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        
        # Serve static files
        if not path.startswith("/api"):
            self.serve_static(path)
            return
        
        # API handlers
        self.handle_api_request("GET", path, query, None)
    
    def do_POST(self):
        """Handle POST requests."""
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        
        # Read body
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""
        data = parse_json_body(body)
        
        self.handle_api_request("POST", path, query, data)
    
    def do_PUT(self):
        """Handle PUT requests."""
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b""
        data = parse_json_body(body)
        
        self.handle_api_request("PUT", path, query, data)
    
    def do_DELETE(self):
        """Handle DELETE requests."""
        parsed = urlparse(self.path)
        path = unquote(parsed.path)
        query = parse_qs(parsed.query)
        
        self.handle_api_request("DELETE", path, query, None)
    
    def serve_static(self, path: str):
        """Serve static files from the static directory."""
        # Default to index.html for root
        if path == "/":
            path = "/index.html"
        
        # Remove leading slash and construct file path
        file_path = STATIC_DIR / path.lstrip("/")
        
        # Security: prevent directory traversal
        try:
            file_path = file_path.resolve()
            static_dir_resolved = STATIC_DIR.resolve()
            if not str(file_path).startswith(str(static_dir_resolved)):
                self.send_json_response(*error_response("Forbidden", 403))
                return
        except (ValueError, OSError):
            self.send_json_response(*error_response("Invalid path", 400))
            return
        
        # Check if file exists
        if file_path.is_file():
            mime_type, _ = mimetypes.guess_type(str(file_path))
            if not mime_type:
                mime_type = "application/octet-stream"
            
            try:
                with open(file_path, "rb") as f:
                    content = f.read()
                
                self.send_response(200)
                self.send_header("Content-Type", mime_type)
                self.send_header("Content-Length", len(content))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return
            except (IOError, OSError) as e:
                self.send_json_response(*error_response(f"Failed to read file: {str(e)}", 500))
                return
        
        # Check for index.html in directory
        index_path = file_path / "index.html"
        if index_path.is_file():
            try:
                with open(index_path, "rb") as f:
                    content = f.read()
                
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.send_header("Content-Length", len(content))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(content)
                return
            except (IOError, OSError):
                pass
        
        # 404 Not Found
        self.send_json_response(*error_response("File not found", 404))
    
    def handle_api_request(self, method: str, path: str, query: Dict, data: Optional[Dict]):
        """Route API requests to appropriate handlers."""
        # Strip /api prefix
        if path.startswith("/api"):
            path = path[4:]
        
        if not path.startswith("/"):
            path = "/" + path
        
        # Route matching
        try:
            # GET /api/orgs
            if method == "GET" and path == "/orgs":
                body, status = asyncio.run(APIHandler.get_orgs())
                self.send_json_response(body, status)
                return
            
            # POST /api/orgs
            if method == "POST" and path == "/orgs":
                if not data:
                    self.send_json_response(*error_response("Request body required", 400))
                    return
                body, status = asyncio.run(APIHandler.create_org(data))
                self.send_json_response(body, status)
                return
            
            # GET /api/agents
            if method == "GET" and path == "/agents":
                org_id = query.get("org_id", [None])[0]
                org_id = int(org_id) if org_id and org_id.isdigit() else None
                body, status = asyncio.run(APIHandler.get_agents(org_id))
                self.send_json_response(body, status)
                return
            
            # POST /api/agents
            if method == "POST" and path == "/agents":
                if not data:
                    self.send_json_response(*error_response("Request body required", 400))
                    return
                body, status = asyncio.run(APIHandler.create_agent(data))
                self.send_json_response(body, status)
                return
            
            # PUT /api/settings
            if method == "PUT" and path == "/settings":
                if not data:
                    self.send_json_response(*error_response("Request body required", 400))
                    return
                body, status = asyncio.run(APIHandler.update_settings(data))
                self.send_json_response(body, status)
                return
            
            # GET /api/settings
            if method == "GET" and path == "/settings":
                org_id = query.get("org_id", [None])[0]
                org_id = int(org_id) if org_id and org_id.isdigit() else None
                body, status = asyncio.run(APIHandler.get_settings(org_id))
                self.send_json_response(body, status)
                return
            
            # GET /api/system/status
            if method == "GET" and path == "/system/status":
                body, status = asyncio.run(APIHandler.get_system_status())
                self.send_json_response(body, status)
                return
            
            # Pattern matching for /api/agents/:id/* routes
            agent_match = re.match(r"^/agents/(\d+)(/.*)?$", path)
            if agent_match:
                agent_id = int(agent_match.group(1))
                subpath = agent_match.group(2) or ""
                
                # GET /api/agents/:id
                if method == "GET" and subpath == "":
                    body, status = asyncio.run(APIHandler.get_agent(agent_id))
                    self.send_json_response(body, status)
                    return
                
                # PUT /api/agents/:id
                if method == "PUT" and subpath == "":
                    if not data:
                        self.send_json_response(*error_response("Request body required", 400))
                        return
                    body, status = asyncio.run(APIHandler.update_agent(agent_id, data))
                    self.send_json_response(body, status)
                    return
                
                # DELETE /api/agents/:id
                if method == "DELETE" and subpath == "":
                    body, status = asyncio.run(APIHandler.delete_agent(agent_id))
                    self.send_json_response(body, status)
                    return
                
                # GET /api/agents/:id/messages
                if method == "GET" and subpath == "/messages":
                    limit = int(query.get("limit", [100])[0])
                    offset = int(query.get("offset", [0])[0])
                    body, status = asyncio.run(APIHandler.get_messages(agent_id, limit, offset))
                    self.send_json_response(body, status)
                    return
                
                # POST /api/agents/:id/messages
                if method == "POST" and subpath == "/messages":
                    if not data:
                        self.send_json_response(*error_response("Request body required", 400))
                        return
                    body, status = asyncio.run(APIHandler.create_message(agent_id, data))
                    self.send_json_response(body, status)
                    return
                
                # GET /api/agents/:id/resources
                if method == "GET" and subpath == "/resources":
                    body, status = asyncio.run(APIHandler.get_resources(agent_id))
                    self.send_json_response(body, status)
                    return
                
                # POST /api/agents/:id/chat
                if method == "POST" and subpath == "/chat":
                    if not data:
                        self.send_json_response(*error_response("Request body required", 400))
                        return
                    body, status = asyncio.run(APIHandler.chat(agent_id, data))
                    self.send_json_response(body, status)
                    return
                
                # POST /api/agents/:id/spawn
                if method == "POST" and subpath == "/spawn":
                    body, status = asyncio.run(APIHandler.spawn(agent_id, data or {}))
                    self.send_json_response(body, status)
                    return
            
            # No route matched
            self.send_json_response(*error_response(f"Endpoint not found: {method} {path}", 404))
            
        except ValueError as e:
            self.send_json_response(*error_response(f"Invalid ID format: {str(e)}", 400))
        except Exception as e:
            self.send_json_response(*error_response(f"Internal server error: {str(e)}", 500))


# ============================================================================
# Server Lifecycle
# ============================================================================

async def initialize_server():
    """Initialize the server components."""
    await db.initialize()
    print(f"[{datetime.now().isoformat()}] Database initialized at {DB_PATH}")


def run_server():
    """Run the HTTP server."""
    # Create and initialize event loop
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    # Initialize database
    loop.run_until_complete(initialize_server())
    
    # Create server
    server = HTTPServer((SERVER_HOST, SERVER_PORT), HermesDashboardHandler)
    
    print(f"[{datetime.now().isoformat()}] Hermes Dashboard API Server")
    print(f"Listening on http://{SERVER_HOST}:{SERVER_PORT}")
    print(f"Static files: {STATIC_DIR}")
    print(f"Database: {DB_PATH}")
    print("Press Ctrl+C to stop")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n[{datetime.now().isoformat()}] Shutting down...")
        server.shutdown()
        loop.run_until_complete(db.close())
    finally:
        loop.close()


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    run_server()
