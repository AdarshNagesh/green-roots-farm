import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // GET — fetch all settings or a specific key
  if (req.method === 'GET') {
    const { key } = req.query
    if (key) {
      const { data, error } = await admin.from('settings').select('value').eq('key', key).single()
      if (error) return res.status(200).json({ value: null })
      return res.status(200).json({ value: data.value })
    }
    const { data } = await admin.from('settings').select('*')
    return res.status(200).json(data || [])
  }

  // POST — upsert a setting
  if (req.method === 'POST') {
    const { key, value } = req.body
    if (!key || value === undefined) return res.status(400).json({ error: 'Missing key or value' })
    const { error } = await admin.from('settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
