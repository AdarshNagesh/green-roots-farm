import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // GET — fetch settlements for a farm
  if (req.method === 'GET') {
    const { farm_id } = req.query
    let query = admin.from('settlements').select('*').order('created_at', { ascending: false })
    if (farm_id) query = query.eq('farm_id', farm_id)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  // POST — record a new settlement
  if (req.method === 'POST') {
    const { farm_id, amount, reference, notes, period_from, period_to, settled_by } = req.body
    if (!farm_id || !amount || !settled_by)
      return res.status(400).json({ error: 'Missing required fields' })
    const { data, error } = await admin.from('settlements').insert({
      farm_id, amount: parseFloat(amount),
      reference: reference || null,
      notes: notes || null,
      period_from: period_from || null,
      period_to:   period_to   || null,
      settled_by,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // DELETE — remove a settlement (admin only, for corrections)
  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })
    await admin.from('settlements').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
