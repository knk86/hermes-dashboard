# Deploying to Railway

Railway runs a full Linux container — perfect for the Python server + SQLite dashboard. Zero config needed.

---

## Prerequisites

- A [Railway](https://railway.app) account (free tier: $5/month credit, enough for this project)
- A GitHub repo with the dashboard code (already at `knk86/hermes-dashboard`)

---

## Step 1: Create a Railway Project

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Select `knk86/hermes-dashboard`
3. Railway will auto-detect Python and the `Procfile`

---

## Step 2: Configure the Deployment

In the Railway project dashboard:

### Set Variables

Go to **Variables** and add:

| Variable | Value | Notes |
|----------|-------|-------|
| `HERMES_HOST` | `0.0.0.0` | Listen on all interfaces |
| `HERMES_PORT` | `8080` | Railway routes HTTP traffic to this |
| `CORS_ORIGINS` | `*` | Allow all origins (use your domain in prod) |
| `DB_PATH` | `/data/dashboard.db` | Railway persistent disk |
| `HERMES_HOME` | `/app/.hermes` | For Hermes CLI config |

### Add a Persistent Disk

1. Go to **Storage** → **Add Persistent Disk**
2. Name it `dashboard-data` (or anything)
3. Set the mount path to `/data`
4. This ensures your SQLite database survives redeployments

---

## Step 3: Configure the Start Command

Go to **Settings** → **Start Command**, or add a `Procfile` to the repo root:

```
web: python server/server.py
```

Railway already has the `Procfile` in the repo. It will use `python server/server.py`.

---

## Step 4: Deploy

Click **Deploy** — Railway will:
1. Clone the repo
2. Run `pip install -r requirements.txt`
3. Start `python server/server.py`
4. The app will be live at `https://your-project.railway.app`

---

## Step 5: Verify It Works

```bash
curl https://your-project.railway.app/api/system/status
```

Should return JSON with `"status": "healthy"`.

---

## (Optional) Point Your Domain

Railway → Project → Settings → Networking → **Public Networking** → Enable.

Then add a custom domain in **Settings → Domains**.

---

## (Optional) Supabase for Production Data

The dashboard uses SQLite locally. For production with team collaboration, swap to Supabase:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. In Railway Variables, add:
   ```
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
   ```
4. Update `server/server.py` to use `asyncpg` or `psycopg2` instead of SQLite

---

## Architecture

```
Browser
  │
  ▼
Railway (persistent Linux container)
  │
  ├─ python server/server.py  ← long-running process
  │   └─ SQLite at /data/dashboard.db
  │
  └─ 8080/tcp (proxied to public HTTPS)
```

Full chat + tmux agent spawning works on Railway since it's a real container.
