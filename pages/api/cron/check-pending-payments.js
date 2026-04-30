import { createClient } from '@supabase/supabase-js'
import Razorpay from 'razorpay'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export default async function handler(req, res) {
  // Only allow cron calls with secret
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  // Find orders stuck in Payment Pending for more than 30 minutes
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data: pendingOrders, error } = await supabaseAdmin
    .from('orders')
    .select('id, razorpay_order_id, total, user_id, items')
    .eq('status', 'Payment Pending')
    .eq('payment_method', 'razorpay')
    .lt('created_at', cutoff)

  if (error) return res.status(500).json({ error: error.message })
  if (!pendingOrders?.length) return res.status(200).json({ checked: 0 })

  const results = []

  for (const order of pendingOrders) {
    if (!order.razorpay_order_id) continue

    try {
      // Fetch payments for this Razorpay order
      const payments = await razorpay.orders.fetchPayments(order.razorpay_order_id)
      const captured = payments.items?.find(p => p.status === 'captured')

      if (captured) {
        // Payment exists and was captured — update order
        await supabaseAdmin.from('orders').update({
          status:              'Confirmed',
          payment_status:      'paid',
          razorpay_payment_id: captured.id,
          updated_at:          new Date().toISOString(),
        }).eq('id', order.id)

        // Deduct stock
        if (order.items?.length > 0) {
          const stockItems = order.items.map(i => ({
            id:         i.id,
            qty:        i.qty,
            multiplier: i.multiplier || 1,
          }))
          await supabaseAdmin.rpc('deduct_stock_for_order', { p_items: stockItems })
        }

        // Notify customer via in-app notification
        await supabaseAdmin.from('notifications').insert({
          user_id: order.user_id,
          message: `✅ Your payment was confirmed and order #${order.id.slice(0,8).toUpperCase()} is now confirmed!`,
          type:    'order',
        })

        results.push({ id: order.id, action: 'confirmed' })
      } else {
        // No captured payment after 30 mins — cancel order
        await supabaseAdmin.from('orders').update({
          status:     'Cancelled',
          cancel_reason: 'Payment not completed within 30 minutes.',
          updated_at: new Date().toISOString(),
        }).eq('id', order.id)

        // Notify customer
        await supabaseAdmin.from('notifications').insert({
          user_id: order.user_id,
          message: `❌ Order #${order.id.slice(0,8).toUpperCase()} was cancelled as payment was not completed. Please try again.`,
          type:    'order',
        })

        results.push({ id: order.id, action: 'cancelled' })
      }
    } catch (e) {
      console.error('Error checking order', order.id, e.message)
      results.push({ id: order.id, action: 'error', error: e.message })
    }
  }

  return res.status(200).json({ checked: pendingOrders.length, results })
}