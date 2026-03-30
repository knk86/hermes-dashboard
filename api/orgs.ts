import { supabase, jsonResponse, errorResponse, getCorsHeaders, handleOptions } from './lib/supabase'

export default async function handler(req: Request) {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  // GET /api/orgs
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('orgs')
      .select('id, name, description, is_active, created_at, updated_at')
      .order('name')

    if (error) {
      return errorResponse(`Failed to fetch organizations: ${error.message}`, 500)
    }
    return jsonResponse({ orgs: data, count: data?.length ?? 0 })
  }

  // POST /api/orgs
  if (req.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const name = body.name as string
    if (!name) {
      return errorResponse('Organization name is required', 400)
    }

    const description = (body.description as string) ?? ''
    const mission = (body.mission as string) ?? ''

    const { data, error } = await supabase
      .from('orgs')
      .insert({ name, description, mission })
      .select('id, name, description, is_active, created_at, updated_at')
      .single()

    if (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return errorResponse(`Organization '${name}' already exists`, 409)
      }
      return errorResponse(`Failed to create organization: ${error.message}`, 500)
    }

    return jsonResponse(data, 201)
  }

  return errorResponse('Method not allowed', 405)
}
