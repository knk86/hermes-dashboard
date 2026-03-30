import { supabase, jsonResponse, errorResponse, getCorsHeaders, handleOptions } from '../../lib/supabase'

const AGENT_SELECT = `id, org_id, name, role, mission, description, tmux_session,
  status, cpu_percent, memory_mb, uptime_seconds, last_heartbeat,
  model, provider, avatar_seed, avatar_style, system_prompt,
  created_at, updated_at`

export default async function handler(req: Request, context: { params?: { id?: string } }) {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  const agentId = context.params?.id
  if (!agentId || isNaN(parseInt(agentId))) {
    return errorResponse('Invalid agent ID', 400)
  }
  const id = parseInt(agentId)

  // GET /api/agents/:id
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('agents')
      .select(AGENT_SELECT)
      .eq('id', id)
      .single()

    if (error) {
      if (error.message.includes('No rows')) {
        return errorResponse(`Agent ${id} not found`, 404)
      }
      return errorResponse(`Failed to fetch agent: ${error.message}`, 500)
    }

    // tmux/spawn/resources not available in serverless — return stub process_status
    data.process_status = null

    return jsonResponse(data)
  }

  // PUT /api/agents/:id
  if (req.method === 'PUT') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const allowedFields = [
      'name', 'role', 'mission', 'description', 'tmux_session',
      'status', 'model', 'provider', 'avatar_seed', 'avatar_style',
      'system_prompt', 'cpu_percent', 'memory_mb', 'uptime_seconds', 'last_heartbeat',
    ]

    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field]
      }
    }
    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select(AGENT_SELECT)
      .single()

    if (error) {
      return errorResponse(`Failed to update agent: ${error.message}`, 500)
    }

    return jsonResponse(data)
  }

  // DELETE /api/agents/:id
  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)

    if (error) {
      return errorResponse(`Failed to delete agent: ${error.message}`, 500)
    }

    return jsonResponse({ message: `Agent ${id} deleted successfully` })
  }

  return errorResponse('Method not allowed', 405)
}
