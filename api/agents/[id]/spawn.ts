import { jsonResponse, errorResponse, getCorsHeaders, handleOptions } from '../../../lib/supabase'

export default async function handler(req: Request, context: { params?: { id?: string } }) {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  const agentId = context.params?.id
  if (!agentId || isNaN(parseInt(agentId))) {
    return errorResponse('Invalid agent ID', 400)
  }
  const id = parseInt(agentId)

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // tmux spawning is not available in serverless environments
  // The agent runs as a stateless function, not a persistent process
  return jsonResponse({
    error: 'Spawn not available in serverless deployment',
    message: `Agent ${id} cannot be spawned from a serverless environment. ` +
      `tmux and background processes are not supported on Vercel Functions. ` +
      `For persistent agent processes, deploy to a VPS with tmux support.`,
    agent_id: id,
    stub: true,
  }, 501)
}
