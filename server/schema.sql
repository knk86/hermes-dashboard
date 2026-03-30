-- Alfred's Dashboard — Database Schema
-- SQLite

-- Settings (key-value store, per-org)
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER DEFAULT 1,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL,
    value_type TEXT DEFAULT 'string',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(org_id, setting_key)
);

-- Organizations
CREATE TABLE IF NOT EXISTS orgs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    mission TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agents — one row per sub-agent in the org
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    role TEXT,                          -- e.g. "Research & Strategy", "Product Development"
    mission TEXT NOT NULL,              -- canonical mission statement
    description TEXT,                   -- short human description
    tmux_session TEXT,                  -- links to actual tmux session name
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle','running','attention','stopped')),
    cpu_percent REAL DEFAULT 0,          -- latest CPU reading
    memory_mb INTEGER DEFAULT 0,         -- latest memory reading (MB)
    uptime_seconds INTEGER DEFAULT 0,    -- seconds since agent started
    last_heartbeat TIMESTAMP,           -- last poll/ping
    model TEXT DEFAULT 'minimax/minimax-m2.7',
    provider TEXT DEFAULT 'openrouter',
    avatar_seed TEXT,
    avatar_style TEXT DEFAULT 'bottts',
    system_prompt TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE
);

-- Conversations — per-agent chat sessions
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER DEFAULT 1,
    agent_id INTEGER NOT NULL,
    title TEXT,
    message_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
    content TEXT NOT NULL,
    thinking TEXT,
    metadata TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

-- Resource history logs (for charts)
CREATE TABLE IF NOT EXISTS resource_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER DEFAULT 1,
    agent_id INTEGER NOT NULL,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('cpu','memory','tokens','api_calls','errors','latency')),
    value REAL NOT NULL,
    unit TEXT,
    metadata TEXT,
    logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Seed default settings
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('theme', 'dark');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('poll_interval', '3000');
INSERT OR IGNORE INTO settings (setting_key, setting_value) VALUES ('show_thinking', 'false');

-- Seed the default org
INSERT OR IGNORE INTO orgs (id, name, description, mission) VALUES (
    1,
    "Alfred's YouTube Agency",
    "YouTube production pipeline for comic-narration Bible stories",
    "Align sub-agents toward shipping profitable content and scaling MRR through the precise execution of complex workflows."
);

-- Seed the 5 YouTube pipeline agents
INSERT OR IGNORE INTO agents (id, org_id, name, role, mission, status, avatar_style) VALUES
(1, 1, "The Architect",      "Continuity & Bible Consistency", "Master Chronology keeper for the Bible story YouTube series. Maintains the Genesis-to-Revelation Bible — character descriptions, world-building rules, timeline continuity — so sub-agents never hallucinate inconsistent details.", "idle", "bottts"),
(2, 1, "The Narrator",        "Script, Dialogue & Voice Direction", "Converts Bible stories into comic-book style scripts with punchy dialogue, dramatic hooks, and chronological callbacks. Handles script architecture, dialogue writing, and voice direction.", "idle", "bottts"),
(3, 1, "The Visual Director",  "Visual Art Direction & Comic Panels", "Translates scripts into image generation prompts for Midjourney/Flux/SD. Creates Character Sheets, dictates panel layouts and camera angles, enforces the comic aesthetic.", "idle", "bottts"),
(4, 1, "The Growth Agent",    "Retention, SEO & Virality", "Analyzes scripts for retention traps, suggests visual cliffhangers, generates A/B title variants, crafts metadata, optimizes thumbnails, and tracks SEO opportunities.", "idle", "bottts"),
(5, 1, "The Publishing Agent","Publishing, Scheduling & Shorts/Clips", "Handles operational execution: uploading videos, scheduling, adding chapters, creating community posts, cutting Shorts/Reels from long-form content, and reporting performance metrics.", "idle", "bottts");
