import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { order, newStatus } = req.body
  if (!order || !newStatus) return res.status(400).json({ error: 'Missing fields' })

  // Verify caller is allowed: order owner, admin, or farm owner of this order
  const { data: dbOrder } = await admin.from('orders')
    .select('user_id, farm_id').eq('id', order.id).single()
  if (!dbOrder) return res.status(404).json({ error: 'Order not found' })

  const isAdminUser = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL

  let isFarmOwner = false
  if (!isAdminUser && dbOrder.farm_id) {
    const { data: farm } = await admin.from('farms')
      .select('owner_id').eq('id', dbOrder.farm_id).single()
    isFarmOwner = farm?.owner_id === user.id
  }

  const isOrderOwner = dbOrder.user_id === user.id

  if (!isOrderOwner && !isAdminUser && !isFarmOwner)
    return res.status(403).json({ error: 'Forbidden' })

  // Server-side internal calls
  const secret = process.env.INTERNAL_API_SECRET
  const headers = {
    'Content-Type': 'application/json',
    'x-internal-secret': secret,
  }
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adarshini.co.in'

  await Promise.allSettled([
    fetch(`${baseUrl}/api/notify/email`, {
      method: 'POST', headers,
      body: JSON.stringify({ type: statusToType(newStatus), order }),
    }),
    fetch(`${baseUrl}/api/notify/admin-order`, {
      method: 'POST', headers,
      body: JSON.stringify({ order }),
    }),
  ])

  res.status(200).json({ success: true })
}

function statusToType(status) {
  const map = {
    'Confirmed': 'confirmed', 'Preparing': 'preparing',
    'Out for Delivery': 'delivering', 'Delivered': 'delivered',
    'Cancelled': 'cancelled',
  }
  return map[status] || 'confirmed'
}
