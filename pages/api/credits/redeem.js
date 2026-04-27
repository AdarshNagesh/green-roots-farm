import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user_id, points_to_redeem, order_id } = req.body
  if (!user_id || !points_to_redeem || !order_id) return res.status(400).json({ error: 'Missing fields' })

  // ✅ Check double-redemption FIRST
  const { data: order } = await admin.from('orders')
    .select('points_redeemed').eq('id', order_id).single()
  if (order?.points_redeemed > 0)
    return res.status(400).json({ error: 'Points already redeemed for this order' })

  // Then fetch balance
  const { data: profile } = await admin.from('profiles')
    .select('points_balance').eq('id', user_id).single()
  if (!profile) return res.status(404).json({ error: 'User not found' })
  if (profile.points_balance < points_to_redeem)
    return res.status(400).json({ error: 'Insufficient points balance' })

  const newBalance = profile.points_balance - points_to_redeem
  await admin.from('profiles').update({ points_balance: newBalance }).eq('id', user_id)
  await admin.from('credit_transactions').insert({
    user_id,
    points:      -points_to_redeem,
    type:        'redemption',
    description: `Redeemed ${points_to_redeem} points for ₹${points_to_redeem} off order #${order_id.slice(0,8).toUpperCase()}`,
    order_id,
  })

  return res.status(200).json({ success: true, new_balance: newBalance })
}
