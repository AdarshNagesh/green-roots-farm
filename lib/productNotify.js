/**
 * Sends product add/update email to all registered customers.
 * Skips notification if product is hidden (is_visible = false).
 * Sends notification when product is unhidden (is_visible = true).
 */
export async function notifyCustomersOfProduct(product, isNew) {
  try {
    // Do not notify customers about hidden products
    if (product.is_visible === false) return

    // Fetch all customer emails
    const res = await fetch('/api/admin/customers')
    if (!res.ok) return
    const customers = await res.json()
    const emails = customers.map(c => c.email).filter(Boolean)
    if (emails.length === 0) return

    // Fire product email to all
    await fetch('/api/notify/email', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type:    isNew ? 'product_new' : 'product_update',
        product: { ...product, emails },
      }),
    })
  } catch (err) {
    console.error('Product notify error:', err)
  }
}
