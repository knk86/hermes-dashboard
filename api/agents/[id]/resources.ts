import { supabase, jsonResponse, errorResponse, getCorsHeaders, handleOptions } from '../../../lib/supabase'

export default async function handler(req: Request, context: { params?: { id?: string } }) {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  const agentId = context.params?.id
  if (!agentId || isNaN(parseInt(agentId))) {
    return errorResponse('Invalid agent ID', 400)
  }
  const id = parseInt(agentId)

  // Verify agent exists
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', id)
    .single()

  if (!agent) {
    return errorResponse(`Agent ${id} not found`, 404)
  }

  if (req.method === 'GET') {
    // tmux/psutil not available in serverless — return stub resource data
    const { data: logs } = await supabase
      .from('resource_logs')
      .select('id, resource_type, value, unit, metadata, logged_at')
      .eq('agent_id', id)
      .order('logged_at', { ascending: false })
      .limit(100)

    return jsonResponse({
      agent_id: id,
      status: 'idle',
      session_name: null,
      process: null,
      heartbeat: null,
      system: null,
      logs: logs ?? [],
      stub: true,
      note: 'Process monitoring not available in serverless. Deploy to a VPS for full resource monitoring.',
    })
  }

  return errorResponse('Method not allowed', 405)
}
