import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {

  // GET — fetch aggregate ratings for products
  if (req.method === 'GET') {
    const { product_id } = req.query
    let query = admin.from('ratings').select('product_id, farm_id, delivery_rating, quality_rating')
    if (product_id) query = query.eq('product_id', product_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })

    const agg = {}
    for (const r of data || []) {
      const key = `${r.product_id}_${r.farm_id || 'none'}`
      if (!agg[key]) agg[key] = { product_id: r.product_id, farm_id: r.farm_id, delivery: [], quality: [] }
      if (r.delivery_rating) agg[key].delivery.push(r.delivery_rating)
      if (r.quality_rating)  agg[key].quality.push(r.quality_rating)
    }

    const result = Object.entries(agg).map(([key, v]) => ({
      product_id:     v.product_id,
      farm_id:        v.farm_id,
      delivery_avg:   v.delivery.length ? parseFloat((v.delivery.reduce((a,b)=>a+b,0)/v.delivery.length).toFixed(1)) : null,
      quality_avg:    v.quality.length  ? parseFloat((v.quality.reduce((a,b)=>a+b,0)/v.quality.length).toFixed(1))  : null,
      delivery_count: v.delivery.length,
      quality_count:  v.quality.length,
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
      .select('user_id, status, farm_id').eq('id', order_id).single()
    if (!order || order.user_id !== user.id)
      return res.status(403).json({ error: 'Forbidden' })
    if (order.status !== 'Delivered')
      return res.status(400).json({ error: 'Can only rate delivered orders' })

    // Use product's farm_id as source of truth
    const { data: product } = await admin.from('products')
      .select('farm_id').eq('id', product_id).single()
    const farmId = product?.farm_id || order.farm_id || null

    const { error: upsertErr } = await admin.from('ratings').upsert({
      user_id:         user.id,
      order_id,
      product_id,
      farm_id:         farmId,
      delivery_rating: delivery_rating || null,
      quality_rating:  quality_rating  || null,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id,order_id,product_id,farm_id' })

    if (upsertErr) return res.status(500).json({ error: upsertErr.message })
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
