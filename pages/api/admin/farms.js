import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../../lib/adminAuth'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const adminUser = await requireAdmin(req, res)
  if (!adminUser) return  // already sent 401/403
  // GET — list farms
  if (req.method === 'GET') {
    const { active, pending } = req.query

    let query = admin.from('farms').select('*').order('created_at', { ascending: true })

    if (active === 'true') {
      // Customer-facing: only active + approved
      query = query.eq('is_active', true).eq('is_approved', true)
    } else if (pending === 'true') {
      // Admin pending list
      query = query.eq('is_approved', false)
    }
    // else: all farms (admin panel default)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  // POST — create farm (admin manually adds)
 if (req.method === 'POST') {
  const { name, owner_name, email, phone, platform_fee,
          lat, lng, address, plus_code, pickup_instructions } = req.body
  if (!name || !owner_name || !email) return res.status(400).json({ error: 'Name, owner name and email are required' })
  const { data, error } = await admin.from('farms').insert({
    name, owner_name, email, phone: phone || '',
    platform_fee: parseFloat(platform_fee) || 0,
    is_approved: true, is_active: true,
    lat: lat || null, lng: lng || null,
    address: address || null,
    plus_code: plus_code || null,
    pickup_instructions: pickup_instructions || null,
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}

  // PUT — update farm
if (req.method === 'PUT') {
  const { id, name, owner_name, email, phone, platform_fee, is_active,
          lat, lng, address, plus_code, pickup_instructions } = req.body
  if (!id) return res.status(400).json({ error: 'Missing farm id' })
  const { error } = await admin.from('farms').update({
    name, owner_name, email, phone,
    platform_fee: parseFloat(platform_fee) || 0,
    is_active,
    lat:                  lat || null,
    lng:                  lng || null,
    address:              address || null,
    plus_code:            plus_code || null,
    pickup_instructions:  pickup_instructions || null,
  }).eq('id', id)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}

  // DELETE — deactivate
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing farm id' })
    const { error } = await admin.from('farms').update({ is_active: false }).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
