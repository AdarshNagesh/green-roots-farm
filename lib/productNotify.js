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
    const subsRes = await fetch('/api/push-subscribe', { headers: authHeader })
    if (!subsRes.ok) return
    const { data: subs } = await subsRes.json()
    if (!subs?.length) return

    await Promise.allSettled(subs.map(s =>
      fetch('/api/notify/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader },
        body: JSON.stringify({
          user_id: s.user_id,
          title:   'Adarshini Farm 🌿',
          body:    isNew
            ? `New product: ${product.name} is now available!`
            : `${product.name} has been updated — check it out!`,
          url:     '/',
          tag:     'product-' + product.id,
        }),
      })
    ))
  } catch (err) {
    console.error('Product notify error:', err)
  }
}
