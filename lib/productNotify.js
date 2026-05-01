/**
 * Sends product add/update email to all registered customers.
 * Skips notification if product is hidden (is_visible = false).
 * Sends notification when product is unhidden (is_visible = true).
 */
export async function notifyCustomersOfProduct(product, isNew, accessToken) {
  try {
    if (product.is_visible === false) return

    const authHeader = accessToken
      ? { 'Authorization': `Bearer ${accessToken}` }
      : { 'x-internal-secret': process.env.INTERNAL_API_SECRET }

    // Fetch customers
    const res = await fetch('/api/admin/customers', { headers: authHeader })
    if (!res.ok) return
    const customers = await res.json()
    const emails = customers.map(c => c.email).filter(Boolean)
    if (emails.length === 0) return

    // Email all customers
    await fetch('/api/notify/email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify({
        type:    isNew ? 'product_new' : 'product_update',
        product: { ...product, emails },
      }),
    })

    // Push notification to all subscribed customers
    const { createClient } = await import('@supabase/supabase-js')
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
    const { data: subs } = await admin.from('push_subscriptions').select('user_id')
    if (subs?.length) {
      await Promise.allSettled(subs.map(s =>
        fetch('/api/notify/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            user_id: s.user_id,
            title:   'Adarshini Farm 🌿',
            body:    isNew
              ? `New product available: ${product.name}!`
              : `${product.name} has been updated — check it out!`,
            url:     '/',
            tag:     'product-' + product.id,
          }),
        })
      ))
    }
  } catch (err) {
    console.error('Product notify error:', err)
  }
}
