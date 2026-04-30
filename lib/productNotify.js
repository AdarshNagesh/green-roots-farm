/**
 * Sends product add/update email to all registered customers.
 * Skips notification if product is hidden (is_visible = false).
 * Sends notification when product is unhidden (is_visible = true).
 */
export async function notifyCustomersOfProduct(product, isNew) {
  try {
    if (product.is_visible === false) return

    // Fetch customers — needs admin token (server-side only)
    const res = await fetch('/api/admin/customers', {
      headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET },
    })
    if (!res.ok) return
    const customers = await res.json()
    const emails = customers.map(c => c.email).filter(Boolean)
    if (emails.length === 0) return

    await fetch('/api/notify/email', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        type:    isNew ? 'product_new' : 'product_update',
        product: { ...product, emails },
      }),
    })
  } catch (err) {
    console.error('Product notify error:', err)
  }
}
