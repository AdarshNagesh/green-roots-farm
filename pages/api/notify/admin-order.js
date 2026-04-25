import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { order } = req.body
  if (!order) return res.status(400).json({ error: 'Missing order' })

  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL
  if (!adminEmail) return res.status(200).json({ skipped: true })

  const itemsHtml = (order.items || []).map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.name}${i.selected_option ? ` (${i.selected_option})` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">Rs.${((i.effective_price ?? i.price) * i.qty).toFixed(0)}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e6;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #d8cfbc">
    <div style="background:#2d6a27;padding:22px 28px">
      <div style="color:#fff;font-size:20px;font-weight:700">🛒 New Order Received!</div>
      <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:4px">Adarshini Organic Farm</div>
    </div>
    <div style="padding:24px 28px">
      <table style="width:100%;margin-bottom:20px;font-size:13px">
        <tr><td style="padding:4px 0;color:#687165;width:100px">Customer</td><td style="font-weight:600">${order.customer_name}</td></tr>
        <tr><td style="padding:4px 0;color:#687165">Phone</td><td>${order.phone}</td></tr>
        <tr><td style="padding:4px 0;color:#687165">Pincode</td><td>${order.pincode || '—'}</td></tr>
        <tr><td style="padding:4px 0;color:#687165">Address</td><td>${order.address}</td></tr>
        <tr><td style="padding:4px 0;color:#687165">Payment</td><td>${order.payment_method === 'razorpay' ? 'Paid Online' : 'Cash on Delivery'}</td></tr>
        ${order.notes ? `<tr><td style="padding:4px 0;color:#687165">Notes</td><td style="color:#b87d12;font-weight:600">${order.notes}</td></tr>` : ''}
      </table>
      <div style="background:#f5f0e6;border-radius:10px;padding:14px 18px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="border-bottom:2px solid #d8cfbc">
            <th style="padding:6px 12px;text-align:left">Item</th>
            <th style="padding:6px 12px;text-align:center">Qty</th>
            <th style="padding:6px 12px;text-align:right">Amount</th>
          </tr></thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot><tr>
            <td colspan="2" style="padding:10px 12px;font-weight:700">Total</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#2d6a27;font-size:16px">Rs.${Number(order.total).toFixed(2)}</td>
          </tr></tfoot>
        </table>
      </div>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin"
        style="display:block;background:#2d6a27;color:#fff;text-align:center;padding:12px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600">
        Open Admin Panel →
      </a>
    </div>
  </div>
</body></html>`

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: adminEmail,
      subject: `New Order from ${order.customer_name} — Rs.${Number(order.total).toFixed(0)}`,
      html,
    })
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Admin notify error:', err)
    res.status(200).json({ success: false })
  }
}
