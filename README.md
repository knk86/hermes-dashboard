# Hermes Dashboard

A real-time web dashboard for managing and monitoring Hermes AI agents — built as a **Python server with SQLite**, deployable to any VPS or container platform.

## Features

- Organization and agent management (5 YouTube pipeline agents pre-seeded)
- Conversation tracking and message history
- Real-time agent status and resource monitoring
- Dark/light/auto theme with Obsidian-style UI
- Settings management
- Full AI chat with real Hermes CLI (tmux-backed agents)

## Deploy to Railway

**See [DEPLOY_RAILWAY.md](./DEPLOY_RAILWAY.md)** for step-by-step instructions.

Quick version:

1. [railway.app](https://railway.app) → **New Project** → Deploy from GitHub repo → select `knk86/hermes-dashboard`
2. Add a persistent disk at `/data`
3. Set environment variables (see DEPLOY_RAILWAY.md)
4. Deploy

## Tech Stack

- **Backend**: Pure Python stdlib (`http.server` + `aiosqlite`)
- **Database**: SQLite (persistent disk on Railway)
- **Frontend**: Vanilla JS, Inter font, Obsidian-inspired dark theme
- **Deployment**: Railway, Render, Fly.io, or any VPS

## Project Structure

```
hermes-dashboard/
├── server/
│   ├── server.py      # Python HTTP API server
│   └── schema.sql     # SQLite schema + seed data
├── static/            # Frontend assets (dev)
├── public/            # Frontend assets (prod)
├── Procfile           # Railway/Render start command
├── railway.toml       # Railway config
├── requirements.txt
└── DEPLOY_RAILWAY.md  # Step-by-step Railway guide
```

## Local Development

```bash
git clone https://github.com/knk86/hermes-dashboard
cd hermes-dashboard
pip install -r requirements.txt
python server/server.py
# Visit http://localhost:8080
```

## License

MIT
