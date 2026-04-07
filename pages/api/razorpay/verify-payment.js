import crypto                 from 'crypto'
import { createClient }      from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = req.body

  // Verify signature
  const body      = razorpay_order_id + '|' + razorpay_payment_id
  const expected  = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex')

  if (expected !== razorpay_signature)
    return res.status(400).json({ error: 'Invalid payment signature' })

  // Update order in Supabase
  const { error } = await supabaseAdmin.from('orders').update({
    payment_status:      'paid',
    payment_method:      'razorpay',
    razorpay_order_id,
    razorpay_payment_id,
    status:              'Confirmed',
    updated_at:          new Date().toISOString(),
  }).eq('id', order_id)

  if (error) {
    console.error('Supabase update error:', error)
    return res.status(500).json({ error: error.message })
  }

  res.status(200).json({ success: true })
}
