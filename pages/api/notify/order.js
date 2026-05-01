import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Caller must be authenticated user
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { order, newStatus } = req.body
  if (!order || !newStatus) return res.status(400).json({ error: 'Missing fields' })

  // Verify order belongs to this user
  const { data: dbOrder } = await admin.from('orders')
    .select('user_id').eq('id', order.id).single()
  const isAdmin = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
if (!dbOrder || (!isAdmin && dbOrder.user_id !== user.id)) 
  return res.status(403).json({ error: 'Forbidden' })

  // Now call internal notify APIs — these run server-side so INTERNAL_API_SECRET is safe
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
