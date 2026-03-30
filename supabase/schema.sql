-- Hermes Dashboard — Supabase Postgres Schema
-- Run this in the Supabase SQL Editor to set up your database

-- ============================================================================
-- Settings (key-value store, per-org)
-- ============================================================================
CREATE TABLE IF NOT EXISTS settings (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT DEFAULT 1,
    setting_key TEXT NOT NULL,
    setting_value TEXT NOT NULL DEFAULT '',
    value_type TEXT DEFAULT 'string',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, setting_key)
);

-- ============================================================================
-- Organizations
-- ============================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    mission TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Agents — one row per sub-agent in the org
-- ============================================================================
CREATE TABLE IF NOT EXISTS agents (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,                          -- e.g. "Research & Strategy", "Product Development"
    mission TEXT NOT NULL DEFAULT '',   -- canonical mission statement
    description TEXT,                   -- short human description
    tmux_session TEXT,                 -- links to actual tmux session name (server-only)
    status TEXT DEFAULT 'idle' CHECK(status IN ('idle','running','attention','stopped')),
    cpu_percent REAL DEFAULT 0,
    memory_mb INTEGER DEFAULT 0,
    uptime_seconds INTEGER DEFAULT 0,
    last_heartbeat TIMESTAMPTZ,
    model TEXT DEFAULT 'minimax/minimax-m2.7',
    provider TEXT DEFAULT 'openrouter',
    avatar_seed TEXT,
    avatar_style TEXT DEFAULT 'bottts',
    system_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Conversations — per-agent chat sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT DEFAULT 1,
    agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    title TEXT,
    message_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Messages
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    conversation_id BIGINT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
    content TEXT NOT NULL,
    thinking TEXT,
    metadata JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Resource history logs (for charts)
-- ============================================================================
CREATE TABLE IF NOT EXISTS resource_logs (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT DEFAULT 1,
    agent_id BIGINT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('cpu','memory','tokens','api_calls','errors','latency')),
    value REAL NOT NULL,
    unit TEXT,
    metadata JSONB DEFAULT '{}',
    logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agents_org_id ON agents(org_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_org_id ON conversations(org_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_resource_logs_agent_id ON resource_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_resource_logs_logged_at ON resource_logs(logged_at);

-- ============================================================================
-- Seed default settings
-- ============================================================================
INSERT INTO settings (setting_key, setting_value, value_type) VALUES
    ('theme', 'dark', 'string'),
    ('poll_interval', '3000', 'number'),
    ('show_thinking', 'false', 'boolean')
ON CONFLICT (org_id, setting_key) DO NOTHING;

-- ============================================================================
-- Seed the default org
-- ============================================================================
INSERT INTO organizations (id, name, description, mission) VALUES (
    1,
    'Alfred''s YouTube Agency',
    'YouTube production pipeline for comic-narration Bible stories',
    'Align sub-agents toward shipping profitable content and scaling MRR through the precise execution of complex workflows.'
) ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Seed the 5 YouTube pipeline agents
-- ============================================================================
INSERT INTO agents (id, org_id, name, role, mission, status, avatar_style) VALUES
(1, 1, 'The Architect', 'Continuity & Bible Consistency',
 'Master Chronology keeper for the Bible story YouTube series. Maintains the Genesis-to-Revelation Bible — character descriptions, world-building rules, timeline continuity — so sub-agents never hallucinate inconsistent details.',
 'idle', 'bottts'),
(2, 1, 'The Narrator', 'Script, Dialogue & Voice Direction',
 'Converts Bible stories into comic-book style scripts with punchy dialogue, dramatic hooks, and chronological callbacks. Handles script architecture, dialogue writing, and voice direction.',
 'idle', 'bottts'),
(3, 1, 'The Visual Director', 'Visual Art Direction & Comic Panels',
 'Translates scripts into image generation prompts for Midjourney/Flux/SD. Creates Character Sheets, dictates panel layouts and camera angles, enforces the comic aesthetic.',
 'idle', 'bottts'),
(4, 1, 'The Growth Agent', 'Retention, SEO & Virality',
 'Analyzes scripts for retention traps, suggests visual cliffhangers, generates A/B title variants, crafts metadata, optimizes thumbnails, and tracks SEO opportunities.',
 'idle', 'bottts'),
(5, 1, 'The Publishing Agent', 'Publishing, Scheduling & Shorts/Clips',
 'Handles operational execution: uploading videos, scheduling, adding chapters, creating community posts, cutting Shorts/Reels from long-form content, and reporting performance metrics.',
 'idle', 'bottts')
ON CONFLICT DO NOTHING;
