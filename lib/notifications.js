import { supabase } from './supabase'

export async function sendOrderNotifications(order, newStatus) {
  // 1. In-app notification to customer
  try {
    await supabase.from('notifications').insert({
      user_id: order.user_id,
      message: buildStatusMessage(order, newStatus),
      type:    'order',
    })
  } catch (e) { console.error('In-app notif error:', e) }

  // 2. Push notification
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/notify/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        user_id: order.user_id,
        title:   'Adarshini Farm 🌿',
        body:    buildStatusMessage(order, newStatus),
        url:     '/orders',
        tag:     'order-' + order.id,
      }),
    })
  } catch (e) { console.error('Push notify error:', e) }

  // 3. Email to customer — only for key statuses
  try {
    const typeMap = {
      'Confirmed':        'confirmed',
      'Out for Delivery': 'delivering',
      'Delivered':        'delivered',
      'Cancelled':        'cancelled',
    }
    if (!typeMap[newStatus]) return // skip Preparing and others
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/notify/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        type:    typeMap[newStatus],
        order:   { ...order, status: newStatus },
        newStatus,
        notifyAdminToo: false,
      }),
    })
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
