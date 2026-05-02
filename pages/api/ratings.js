import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  // GET — fetch aggregate ratings for products
  if (req.method === 'GET') {
    const { product_id } = req.query
    let query = admin.from('ratings').select('product_id, delivery_rating, quality_rating')
    if (product_id) query = query.eq('product_id', product_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    // Aggregate per product
    const agg = {}
    for (const r of data || []) {
      if (!agg[r.product_id]) agg[r.product_id] = { delivery: [], quality: [] }
      if (r.delivery_rating) agg[r.product_id].delivery.push(r.delivery_rating)
      if (r.quality_rating)  agg[r.product_id].quality.push(r.quality_rating)
    }

    const result = Object.entries(agg).map(([pid, v]) => ({
      product_id:      pid,
      delivery_avg:    v.delivery.length ? parseFloat((v.delivery.reduce((a,b)=>a+b,0)/v.delivery.length).toFixed(1)) : null,
      quality_avg:     v.quality.length  ? parseFloat((v.quality.reduce((a,b)=>a+b,0)/v.quality.length).toFixed(1))  : null,
      delivery_count:  v.delivery.length,
      quality_count:   v.quality.length,
    }))

    return res.status(200).json(product_id ? (result[0] || null) : result)
  }

  // POST — submit a rating (must be authenticated)
  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Unauthorized' })
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

    const { order_id, product_id, delivery_rating, quality_rating } = req.body
    if (!order_id || !product_id) return res.status(400).json({ error: 'Missing fields' })
    if (delivery_rating && (delivery_rating < 1 || delivery_rating > 5))
      return res.status(400).json({ error: 'Rating must be 1-5' })
    if (quality_rating && (quality_rating < 1 || quality_rating > 5))
      return res.status(400).json({ error: 'Rating must be 1-5' })

    // Verify order belongs to user and is delivered
    const { data: order } = await admin.from('orders')
      .select('user_id, status').eq('id', order_id).single()
    if (!order || order.user_id !== user.id)
      return res.status(403).json({ error: 'Forbidden' })
    if (order.status !== 'Delivered')
      return res.status(400).json({ error: 'Can only rate delivered orders' })

    // Upsert — one rating per user per product per order
    const { error: upsertErr } = await admin.from('ratings').upsert({
      user_id:         user.id,
      order_id,
      product_id,
      delivery_rating: delivery_rating || null,
      quality_rating:  quality_rating  || null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,order_id,product_id' })

    if (upsertErr) return res.status(500).json({ error: upsertErr.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
