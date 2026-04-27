import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // GET — list all farms
  if (req.method === 'GET') {
   const { active } = req.query
let query = admin.from('farms').select('*').order('created_at', { ascending: true })
if (active === 'true') query = query.eq('is_active', true)
const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  // POST — create farm
  if (req.method === 'POST') {
    const { name, owner_name, email, phone, platform_fee } = req.body
    if (!name || !owner_name || !email) return res.status(400).json({ error: 'Name, owner name and email are required' })
    const { data, error } = await admin.from('farms').insert({
      name, owner_name, email, phone: phone || '',
      platform_fee: parseFloat(platform_fee) || 0,
      is_active: true,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // PUT — update farm
  if (req.method === 'PUT') {
    const { id, name, owner_name, email, phone, platform_fee, is_active } = req.body
    if (!id) return res.status(400).json({ error: 'Missing farm id' })
    const { error } = await admin.from('farms').update({
      name, owner_name, email, phone,
      platform_fee: parseFloat(platform_fee) || 0,
      is_active,
    }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // DELETE — deactivate farm (soft delete)
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing farm id' })
    const { error } = await admin.from('farms').update({ is_active: false }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
