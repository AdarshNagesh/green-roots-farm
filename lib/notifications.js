/**
 * Client-side helper to fire email + SMS notifications.
 * Call this after order status changes.
 * Non-blocking - won't throw on failure.
 */

const STATUS_TO_TYPE = {
  'Confirmed':        'confirmed',
  'Preparing':        'preparing',
  'Out for Delivery': 'delivering',
  'Delivered':        'delivered',
  'Cancelled':        'cancelled',
}

export async function sendOrderNotifications(order, status) {
  const type = STATUS_TO_TYPE[status]
  if (!type) return

  const payload = { type, order }

  // Fire both in parallel, silently ignore failures
  await Promise.allSettled([
    fetch('/api/notify/email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    }),
    order.phone && fetch('/api/notify/sms', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...payload, phone: order.phone }),
    }),
  ])
}
