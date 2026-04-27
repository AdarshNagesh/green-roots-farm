import { supabase } from './supabase'
import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Fetch farm owner email for an order
async function getFarmOwnerEmail(farmId) {
  if (!farmId) return null
  try {
    const { data } = await adminClient.from('farms')
      .select('email, name').eq('id', farmId).single()
    return data || null
  } catch { return null }
}

export async function sendOrderNotifications(order, newStatus) {
  // 1. In-app notification to customer
  try {
    await adminClient.from('notifications').insert({
      user_id: order.user_id,
      message: buildStatusMessage(order, newStatus),
      type:    'order',
    })
  } catch (e) { console.error('In-app notif error:', e) }

  // 2. Email to customer + CC farm owner
  try {
    const farm = await getFarmOwnerEmail(order.farm_id)
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/notify/email`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:            'order_status',
        order:           { ...order, status: newStatus },
        farm_owner_email: farm?.email || null,
        farm_name:        farm?.name  || null,
      }),
    })
    if (!res.ok) console.error('Email notify failed')
  } catch (e) { console.error('Email notify error:', e) }
}

function buildStatusMessage(order, status) {
  const id = (order.id || '').slice(0, 8).toUpperCase()
  switch (status) {
    case 'Confirmed':        return `✅ Order #${id} confirmed! We're preparing your fresh produce.`
    case 'Preparing':        return `🌿 Order #${id} is being prepared and packed fresh for you.`
    case 'Out for Delivery': return `🚚 Order #${id} is out for delivery! Expect it soon.`
    case 'Delivered':        return `🎉 Order #${id} delivered! Enjoy your fresh produce.`
    case 'Cancelled':
      return order.cancel_reason
        ? `❌ Order #${id} was cancelled. Reason: ${order.cancel_reason}`
        : `❌ Order #${id} was cancelled.`
    default: return `📦 Order #${id} status updated to ${status}.`
  }
}
