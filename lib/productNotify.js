/**
 * Sends product add/update email to all registered customers.
 * Call this after saving a product in admin.
 */
export async function notifyCustomersOfProduct(product, isNew) {
  try {
    // 1. Fetch all customer emails
    const res = await fetch('/api/admin/customers')
    if (!res.ok) return
    const customers = await res.json()
    const emails = customers.map(c => c.email).filter(Boolean)
    if (emails.length === 0) return

    // 2. Fire product email to all
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
