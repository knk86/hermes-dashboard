import { jsonResponse, getCorsHeaders, handleOptions } from '../../lib/supabase'

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  if (req.method === 'GET') {
    return jsonResponse({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      agents: [],
      tmux_sessions: [],
      system_resources: {
        note: 'System monitoring not available in serverless environment',
        cpu_percent: 0,
        memory_percent: 0,
      },
      database: 'supabase',
      environment: 'vercel_serverless',
      stub: true,
    })
  }

  return new Response(JSON.stringify({ error: 'Method not allowed', status: 405 }), {
    status: 405,
    headers: { 'Content-Type': 'application/json' },
  })
}
