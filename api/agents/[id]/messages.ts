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

  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get('limit') ?? '100')
  const offset = parseInt(url.searchParams.get('offset') ?? '0')

  // Verify agent exists
  const { data: agent } = await supabase
    .from('agents')
    .select('id, org_id')
    .eq('id', id)
    .single()

  if (!agent) {
    return errorResponse(`Agent ${id} not found`, 404)
  }

  // GET /api/agents/:id/messages
  if (req.method === 'GET') {
    // Get latest active conversation for this agent
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('agent_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!conv) {
      return jsonResponse({ messages: [], count: 0 })
    }

    const { data, error } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, thinking, metadata, is_deleted, created_at')
      .eq('conversation_id', conv.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      return errorResponse(`Failed to fetch messages: ${error.message}`, 500)
    }

    return jsonResponse({ messages: data, count: data?.length ?? 0 })
  }

  // POST /api/agents/:id/messages
  if (req.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const content = body.content as string
    if (!content) {
      return errorResponse('Message content is required', 400)
    }

    const role = (body.role as string) ?? 'user'
    if (!['user', 'assistant', 'system', 'tool'].includes(role)) {
      return errorResponse('Invalid role. Must be: user, assistant, system, or tool', 400)
    }

    // Get or create active conversation
    let convId: number
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('agent_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (conv) {
      convId = conv.id
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({ org_id: agent.org_id, agent_id: id, title: 'New Conversation', is_active: true })
        .select('id')
        .single()

      if (convError || !newConv) {
        return errorResponse(`Failed to create conversation: ${convError?.message}`, 500)
      }
      convId = newConv.id
    }

    const metadata = typeof body.metadata === 'object' ? JSON.stringify(body.metadata) : '{}'

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: convId,
        role,
        content,
        metadata,
      })
      .select('id, conversation_id, role, content, metadata, created_at')
      .single()

    if (error) {
      return errorResponse(`Failed to create message: ${error.message}`, 500)
    }

    return jsonResponse(data, 201)
  }

  return errorResponse('Method not allowed', 405)
}
