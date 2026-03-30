# Deploying to Vercel + Supabase

This guide deploys the Hermes Dashboard as a **Vercel serverless app** with **Supabase (Postgres)** as the database.

---

## Prerequisites

- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)

---

## Step 1: Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → New Project
2. Give it a name (e.g. `hermes-dashboard`)
3. Choose a region close to your users
4. Save the **Database Password** securely
5. Wait for the project to provision (~2 minutes)

### Run the Schema

1. In Supabase Dashboard → **SQL Editor** → **New Query**
2. Copy-paste the contents of `supabase/schema.sql`
3. Click **Run** to create all tables and seed the default org + 5 agents

### Get Your Credentials

From **Project Settings → API**, copy:
- `SUPABASE_URL` (e.g. `https://xyzabc.supabase.co`)
- `service_role` key (under "service_role secret")

---

## Step 2: Push Code to GitHub

The repo is already at `https://github.com/knk86/hermes-dashboard`.

```bash
git clone https://github.com/knk86/hermes-dashboard
cd hermes-dashboard
git pull  # if needed
```

---

## Step 3: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import `knk86/hermes-dashboard`
3. In **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key |

4. Click **Deploy**

Vercel will auto-detect the `api/` directory as serverless functions and `public/` as static files.

---

## Step 4: Configure Your Supabase Database

After deploying, enable **Row Level Security (RLS)** on your tables if you want user-level isolation. For a personal dashboard, you can leave RLS disabled (the service role key bypasses it anyway).

Go to **Supabase → Database → Replication** and ensure the `public` schema is accessible.

---

## What Works vs. What Stubs

| Feature | Status | Notes |
|---------|--------|-------|
| `GET/POST /api/orgs` | ✅ Works | |
| `GET/POST /api/agents` | ✅ Works | |
| `GET/PUT/DELETE /api/agents/:id` | ✅ Works | |
| `GET/POST /api/agents/:id/messages` | ✅ Works | |
| `GET/PUT /api/settings` | ✅ Works | |
| `GET /api/system/status` | ⚠️ Stub | System monitoring not available in serverless |
| `POST /api/agents/:id/spawn` | ❌ Stub | tmux not available in serverless |
| `POST /api/agents/:id/chat` | ⚠️ Stub | Hermes CLI not available in serverless — returns demo response |
| `GET /api/agents/:id/resources` | ⚠️ Stub | psutil/tmux not available |

### For Full Agent Chat & Spawning

The `/chat` and `/spawn` endpoints require the **Hermes Agent CLI** and **tmux**, which aren't available in Vercel's serverless environment.

For the full AI-powered chat experience, deploy to a VPS instead:
- Clone the repo to a Linux VPS with tmux
- Run `python server/server.py`
- Use the localhost URL or a tunnel (serveo.net, localhost.run)
- Supabase URL in `hermes-agent/.env` pointing to your Supabase project

---

## Custom Domain (Optional)

Vercel → Project → Settings → Domains → Add your domain. SSL is automatic.

---

## Architecture

```
Browser
  │
  ▼
Vercel (serverless functions)
  ├─ api/orgs.ts          → Supabase
  ├─ api/agents/          → Supabase
  ├─ api/settings.ts      → Supabase
  └─ api/system/status.ts → (stub)

Supabase Postgres
  ├─ organizations
  ├─ agents
  ├─ conversations
  ├─ messages
  ├─ settings
  └─ resource_logs
```
