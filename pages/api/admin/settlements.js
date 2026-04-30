import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../../lib/adminAuth'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Farm owners can read their own settlements (verified by token)
  if (req.method === 'GET' && req.query.farm_id) {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

    // Verify user owns this farm
    const { data: profile } = await admin.from('profiles')
      .select('role, owned_farm_id').eq('id', user.id).single()
    const isAdmin = user.email === process.env.ADMIN_EMAIL || profile?.role === 'admin'
    const isFarmOwner = profile?.role === 'farm_owner' && profile?.owned_farm_id === req.query.farm_id

    if (!isAdmin && !isFarmOwner) return res.status(403).json({ error: 'Forbidden' })

    const { data, error } = await admin.from('settlements')
      .select('*').eq('farm_id', req.query.farm_id)
      .order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  // All other routes require admin
  const adminUser = await requireAdmin(req, res)
  if (!adminUser) return

  if (req.method === 'GET') {
    const { data, error } = await admin.from('settlements')
      .select('*').order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  if (req.method === 'POST') {
    const { farm_id, amount, reference, notes, period_from, period_to, settled_by } = req.body
    if (!farm_id || !amount || !settled_by)
      return res.status(400).json({ error: 'Missing required fields' })
    const { data, error } = await admin.from('settlements').insert({
      farm_id, amount: parseFloat(amount),
      reference:   reference   || null,
      notes:       notes       || null,
      period_from: period_from || null,
      period_to:   period_to   || null,
      settled_by,
    }).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'Missing id' })
    await admin.from('settlements').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
