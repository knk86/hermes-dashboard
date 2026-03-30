import { supabase, jsonResponse, errorResponse, getCorsHeaders, handleOptions } from './lib/supabase'

export default async function handler(req: Request) {
  const headers = getCorsHeaders()

  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  const url = new URL(req.url)
  const orgId = url.searchParams.get('org_id')

  // GET /api/settings
  if (req.method === 'GET') {
    let query = supabase
      .from('settings')
      .select('id, org_id, setting_key, setting_value, value_type, updated_at')
      .order('setting_key')

    if (orgId) {
      query = query.eq('org_id', parseInt(orgId))
    }

    const { data, error } = await query

    if (error) {
      return errorResponse(`Failed to fetch settings: ${error.message}`, 500)
    }

    // Parse JSON values
    for (const row of data ?? []) {
      if (row.value_type === 'json' && row.setting_value) {
        try {
          row.setting_value = JSON.parse(row.setting_value)
        } catch {}
      }
    }

    return jsonResponse({ settings: data, count: data?.length ?? 0 })
  }

  // PUT /api/settings
  if (req.method === 'PUT') {
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return errorResponse('Invalid JSON body', 400)
    }

    const results = []
    for (const [key, value] of Object.entries(body)) {
      let valueStr: string
      let valueType: string

      if (typeof value === 'object' && value !== null) {
        valueStr = JSON.stringify(value)
        valueType = 'json'
      } else if (typeof value === 'boolean') {
        valueStr = value ? 'true' : 'false'
        valueType = 'boolean'
      } else if (typeof value === 'number') {
        valueStr = String(value)
        valueType = 'number'
      } else {
        valueStr = String(value)
        valueType = 'string'
      }

      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('setting_key', key)
        .eq('org_id', 1)
        .single()

      let row
      if (existing) {
        const { data: updated } = await supabase
          .from('settings')
          .update({ setting_value: valueStr, value_type: valueType, updated_at: new Date().toISOString() })
          .eq('setting_key', key)
          .eq('org_id', 1)
          .select()
          .single()
        row = updated
      } else {
        const { data: inserted } = await supabase
          .from('settings')
          .insert({ org_id: 1, setting_key: key, setting_value: valueStr, value_type: valueType })
          .select()
          .single()
        row = inserted
      }
      results.push(row)
    }

    return jsonResponse({ settings: results, updated: results.length })
  }

  return errorResponse('Method not allowed', 405)
}
