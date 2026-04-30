import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Verify token
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { order_id, user_id } = req.body
  if (!order_id || !user_id) return res.status(400).json({ error: 'Missing fields' })

  // Verify caller is the same user
  if (user.id !== user_id) return res.status(403).json({ error: 'Forbidden' })

  try {
    const { data: profile } = await admin.from('profiles')
      .select('loyalty_enabled, referred_by, points_balance')
      .eq('id', user_id).single()
    if (!profile?.loyalty_enabled)
      return res.status(200).json({ success: true, pointsEarned: 0, skipped: 'loyalty_not_enabled' })

    // Verify order belongs to this user
    const { data: order } = await admin.from('orders')
      .select('*').eq('id', order_id).eq('user_id', user_id).single()
    if (!order) return res.status(403).json({ error: 'Order not found or not yours' })

    const productIds = [...new Set((order.items || []).map(i => i.id))]
    const { data: products } = await admin.from('products')
      .select('id, points_per_unit').in('id', productIds)
    const productMap = Object.fromEntries((products || []).map(p => [p.id, p]))

    let pointsEarned = 0
    const breakdown = []
    for (const item of (order.items || [])) {
      const prod = productMap[item.id]
      const ppu  = prod?.points_per_unit || 0
      if (ppu > 0) {
        const effectiveQty = item.qty * (item.multiplier || 1)
        const pts = Math.floor(ppu * effectiveQty)
        if (pts > 0) {
          pointsEarned += pts
          breakdown.push(`${item.name} × ${effectiveQty.toFixed(2)} = ${pts} pts`)
        }
      }
    }

    if (pointsEarned > 0) {
      const newBal = (profile.points_balance || 0) + pointsEarned
      await admin.from('profiles').update({ points_balance: newBal }).eq('id', user_id)
      await admin.from('credit_transactions').insert({
        user_id, points: pointsEarned, type: 'purchase',
        description: `Order #${order_id.slice(0,8).toUpperCase()}: ${breakdown.join(', ')}`,
        order_id,
      })
    }

    // Referral reward
    if (profile?.referred_by) {
      const { count } = await admin.from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user_id).eq('status', 'Confirmed')
      if (count === 1) {
        const { data: setting } = await admin.from('settings')
          .select('value').eq('key', 'referral_reward_points').single()
        const rewardPts = parseInt(setting?.value || '20')
        const { data: referrer } = await admin.from('profiles')
          .select('id, points_balance, loyalty_enabled')
          .eq('referral_code', profile.referred_by).single()
        if (referrer) {
          const newBal = (referrer.points_balance || 0) + rewardPts
          await admin.from('profiles').update({ points_balance: newBal }).eq('id', referrer.id)
          await admin.from('credit_transactions').insert({
            user_id: referrer.id, points: rewardPts, type: 'referral',
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
