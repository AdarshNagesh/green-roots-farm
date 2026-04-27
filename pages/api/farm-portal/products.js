import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await admin.from('profiles')
    .select('role, owned_farm_id').eq('id', user.id).single()

  if (profile?.role !== 'farm_owner' || !profile.owned_farm_id)
    return res.status(403).json({ error: 'Not a farm owner' })

  const farmId = profile.owned_farm_id

  if (req.method === 'POST') {
    const payload = { ...req.body, farm_id: farmId }
    const { data, error } = await admin.from('products').insert(payload).select().single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...payload } = req.body
    const { data: existing } = await admin.from('products').select('farm_id').eq('id', id).single()
    if (existing?.farm_id !== farmId) return res.status(403).json({ error: 'Not your product' })
    const { error } = await admin.from('products').update(payload).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
  const { id } = req.body
  const { data: existing } = await admin.from('products').select('farm_id').eq('id', id).single()
  if (existing?.farm_id !== farmId) return res.status(403).json({ error: 'Not your product' })

  // Check active orders
  const { data: orders } = await admin.from('orders')
    .select('id, items')
    .eq('farm_id', farmId)
    .neq('status', 'Cancelled')

  const hasActiveOrder = (orders || []).some(o =>
    (o.items || []).some(item => item.id === id)
  )
  if (hasActiveOrder) return res.status(400).json({ error: 'Cannot delete — product has active orders. Mark as hidden instead.' })

  await admin.from('products').delete().eq('id', id)
  return res.status(200).json({ success: true })
}

  res.status(405).end()
}
