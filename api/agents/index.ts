import { supabase, jsonResponse, errorResponse, getCorsHeaders, handleOptions } from '../../lib/supabase'

const AGENT_SELECT = `id, org_id, name, role, mission, description, tmux_session,
  status, cpu_percent, memory_mb, uptime_seconds, last_heartbeat,
  model, provider, avatar_seed, avatar_style, system_prompt,
  created_at, updated_at`

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  const url = new URL(req.url)
  const orgIdParam = url.searchParams.get('org_id')

  // GET /api/agents
  if (req.method === 'GET') {
    let query = supabase
      .from('agents')
      .select(AGENT_SELECT)
      .order('name')

    if (orgIdParam && !isNaN(parseInt(orgIdParam))) {
      query = query.eq('org_id', parseInt(orgIdParam))
    }

    const { data, error } = await query

    if (error) {
      return errorResponse(`Failed to fetch agents: ${error.message}`, 500)
    }

    // Add stub process_status (tmux not available in serverless)
    for (const agent of data ?? []) {
      agent.process_status = null
    }

    return jsonResponse({ agents: data, count: data?.length ?? 0 })
  }

  // POST /api/agents
  if (req.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const required = ['name', 'org_id']
    for (const field of required) {
      if (!body[field]) {
        return errorResponse(`Field '${field}' is required`, 400)
      }
    }

    // Verify org exists
    const { data: org } = await supabase
      .from('orgs')
      .select('id')
      .eq('id', body.org_id)
      .single()

    if (!org) {
      return errorResponse(`Organization ${body.org_id} not found`, 404)
    }

    const insertData = {
      org_id: body.org_id,
      name: body.name,
      role: body.role ?? '',
      mission: body.mission ?? '',
      description: body.description ?? '',
      tmux_session: body.tmux_session ?? '',
      status: body.status ?? 'idle',
      model: body.model ?? 'minimax/minimax-m2.7',
      provider: body.provider ?? 'openrouter',
      avatar_seed: body.avatar_seed ?? body.name,
      avatar_style: body.avatar_style ?? 'bottts',
      system_prompt: body.system_prompt ?? '',
    }

    const { data, error } = await supabase
      .from('agents')
      .insert(insertData)
      .select(AGENT_SELECT)
      .single()

    if (error) {
      return errorResponse(`Failed to create agent: ${error.message}`, 500)
    }

    return jsonResponse(data, 201)
  }

  return errorResponse('Method not allowed', 405)
}
