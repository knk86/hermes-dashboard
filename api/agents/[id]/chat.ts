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

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const message = (body.message as string) || (body.content as string)
  if (!message) {
    return errorResponse('Message content is required', 400)
  }

  // Get agent + org
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, org_id, name, model, provider, system_prompt')
    .eq('id', id)
    .single()

  if (agentError || !agent) {
    return errorResponse(`Agent ${id} not found`, 404)
  }

  // Get or create conversation
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
    const { data: newConv } = await supabase
      .from('conversations')
      .insert({ org_id: agent.org_id, agent_id: id, title: 'Chat Session', is_active: true })
      .select('id')
      .single()
    if (!newConv) {
      return errorResponse('Failed to create conversation', 500)
    }
    convId = newConv.id
  }

  // Save user message
  const { data: userMsg } = await supabase
    .from('messages')
    .insert({ conversation_id: convId, role: 'user', content: message })
    .select('id, conversation_id, role, content, created_at')
    .single()

  // In serverless: Hermes CLI is not available.
  // Return a helpful stub so the UI remains functional for demo purposes.
  const agentName = agent.name ?? 'Agent'
  const responseContent =
    `Hello! I'm ${agentName}.\n\n` +
    `The Hermes agent CLI is not available in this serverless environment.\n` +
    `To use full AI chat, deploy the dashboard to a VPS or local machine.\n\n` +
    `Your message was: "${message}"\n\n` +
    `Would you like me to help you set up a self-hosted deployment?`

  // Save assistant response
  const { data: assistantMsg } = await supabase
    .from('messages')
    .insert({
      conversation_id: convId,
      role: 'assistant',
      content: responseContent,
      metadata: JSON.stringify({ model: agent.model ?? 'stub', stub: true }),
    })
    .select('id, conversation_id, role, content, metadata, created_at')
    .single()

  return jsonResponse({
    conversation_id: convId,
    user_message: userMsg,
    assistant_message: assistantMsg,
    stub: true,
    note: 'Hermes CLI not available in serverless — responses are stubs. Deploy locally or to a VPS for full AI functionality.',
  }, 200)
}
