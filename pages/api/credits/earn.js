import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { order_id, user_id } = req.body
  if (!order_id || !user_id) return res.status(400).json({ error: 'Missing fields' })

  try {
    // Fetch the order with items
    const { data: order } = await admin.from('orders')
      .select('*').eq('id', order_id).single()
    if (!order) return res.status(404).json({ error: 'Order not found' })

    // Fetch product details for points_per_unit
    const productIds = [...new Set((order.items || []).map(i => i.id))]
    const { data: products } = await admin.from('products')
      .select('id, points_per_unit').in('id', productIds)
    const productMap = Object.fromEntries((products || []).map(p => [p.id, p]))

    // Calculate points earned from this order
    let pointsEarned = 0
    const breakdown = []
    for (const item of (order.items || [])) {
      const prod = productMap[item.id]
      const ppu  = prod?.points_per_unit || 0
      if (ppu > 0) {
        const pts = Math.floor(ppu * item.qty)
        pointsEarned += pts
        breakdown.push(`${item.name} × ${item.qty} = ${pts} pts`)
      }
    }

    // Award purchase points
    if (pointsEarned > 0) {
      await admin.from('profiles')
        .update({ points_balance: admin.rpc ? undefined : undefined })
        .eq('id', user_id)

      // Use raw SQL to increment
      await admin.rpc('increment_points', { user_id_input: user_id, amount: pointsEarned })
        .catch(async () => {
          // Fallback: fetch current and update
          const { data: prof } = await admin.from('profiles').select('points_balance').eq('id', user_id).single()
          await admin.from('profiles').update({ points_balance: (prof?.points_balance || 0) + pointsEarned }).eq('id', user_id)
        })

      await admin.from('credit_transactions').insert({
        user_id,
        points:      pointsEarned,
        type:        'purchase',
        description: `Order #${order_id.slice(0,8).toUpperCase()}: ${breakdown.join(', ')}`,
        order_id,
      })
    }

    // Check if this is the referred customer's FIRST confirmed order
    // If so, award 20 points to the referrer
    const { data: profile } = await admin.from('profiles')
      .select('referred_by, points_balance').eq('id', user_id).single()

    if (profile?.referred_by) {
      // Count previously confirmed orders for this user
      const { count } = await admin.from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id)
        .eq('status', 'Confirmed')

      if (count === 1) {
        // This is their first confirmed order — reward the referrer
        const { data: referrer } = await admin.from('profiles')
          .select('id, points_balance').eq('referral_code', profile.referred_by).single()

        if (referrer) {
          const newBal = (referrer.points_balance || 0) + 20
          await admin.from('profiles').update({ points_balance: newBal }).eq('id', referrer.id)
          await admin.from('credit_transactions').insert({
            user_id:     referrer.id,
            points:      20,
            type:        'referral',
            description: `Referral reward — friend placed their first order!`,
            order_id,
          })
        }
      }
    }

    return res.status(200).json({ success: true, pointsEarned })
  } catch (err) {
    console.error('Credits earn error:', err)
    return res.status(500).json({ error: err.message })
  }
}
