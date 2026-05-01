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

 // 2. Push notification (if customer has PWA installed)
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adarshini.co.in'
    const pushRes = await fetch(`${baseUrl}/api/notify/push`, {
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
    const pushResult = await pushRes.json()
    alert('Push result: ' + pushRes.status + ' ' + JSON.stringify(pushResult))
  } catch (e) {
    alert('Push error: ' + e.message)
  }

  // 3. Email to customer
  try {
    const typeMap = {
      'Confirmed':        'confirmed',
      'Preparing':        'preparing',
      'Out for Delivery': 'delivering',
      'Delivered':        'delivered',
      'Cancelled':        'cancelled',
    }
    const { data: { session } } = await supabase.auth.getSession()
    console.log('SESSION TOKEN EXISTS:', !!session?.access_token)
    console.log('ORDER USER ID:', order.user_id)
    const response = await fetch('/api/notify/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({
        type:    typeMap[newStatus] || 'confirmed',
        order:   { ...order, status: newStatus },
        newStatus,
        notifyAdminToo: false,
      }),
    })
    const result = await response.json()
    console.log('NOTIFY RESPONSE:', response.status, result)
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
