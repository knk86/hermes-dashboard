# Hermes Dashboard

A real-time web dashboard for managing and monitoring Hermes AI agents — built as a **Vercel serverless app** with **Supabase (Postgres)** as the database.

## Features

- Organization and agent management (5 YouTube pipeline agents pre-seeded)
- Conversation tracking and message history
- Real-time agent status and resource monitoring
- Dark/light/auto theme with Obsidian-style UI
- Settings management

## Deployment

**See [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md)** for step-by-step instructions.

Quick version:

1. Create a Supabase project → run `supabase/schema.sql` in the SQL Editor
2. Import this repo in Vercel
3. Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as environment variables
4. Deploy

## Tech Stack

- **API**: Vercel Serverless Functions (TypeScript)
- **Database**: Supabase Postgres
- **Frontend**: Vanilla JS, CSS, Inter font, Obsidian-inspired theme
- **AI Chat**: Demo stubs on serverless; real Hermes CLI on VPS/local

## Project Structure

```
hermes-dashboard/
├── api/                    # Vercel serverless functions
│   ├── lib/supabase.ts     # Supabase client
│   ├── orgs.ts             # /api/orgs
│   ├── settings.ts         # /api/settings
│   ├── agents/
│   │   ├── index.ts        # /api/agents
│   │   └── [id]/
│   │       ├── messages.ts # /api/agents/:id/messages
│   │       ├── chat.ts     # /api/agents/:id/chat
│   │       ├── resources.ts
│   │       └── spawn.ts
│   └── system/status.ts
├── public/                 # Static frontend (served by Vercel)
│   ├── index.html
│   ├── css/
│   └── js/
├── supabase/
│   └── schema.sql          # Postgres schema + seed data
├── vercel.json
├── package.json
└── DEPLOY_VERCEL.md        # Full deployment guide
```

## Development (Local)

For full agent spawning and AI chat, run the **original Python server** locally:

```bash
git clone https://github.com/knk86/hermes-dashboard
cd hermes-dashboard
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Point to your Supabase project
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-key
export HERMES_PORT=8080

python server/server.py
```

Then visit `http://localhost:8080`.

## License

MIT
