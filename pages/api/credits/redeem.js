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

  const { user_id, points_to_redeem, order_id } = req.body
  if (!user_id || !points_to_redeem || !order_id) return res.status(400).json({ error: 'Missing fields' })

  // Verify caller is the same user
  if (user.id !== user_id) return res.status(403).json({ error: 'Forbidden' })

  // Verify order belongs to this user
  const { data: order } = await admin.from('orders')
    .select('points_redeemed, user_id').eq('id', order_id).single()
  if (!order) return res.status(404).json({ error: 'Order not found' })
  if (order.user_id !== user_id) return res.status(403).json({ error: 'Forbidden' })
  if (order.points_redeemed > 0) return res.status(400).json({ error: 'Points already redeemed for this order' })

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
