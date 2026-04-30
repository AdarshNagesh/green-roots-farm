import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const { type, order, product } = req.body

  // ── Product notification (broadcast to all customers) ─────────────────────
  if (type === 'product_new' || type === 'product_update') {
    if (!product || !product.emails || product.emails.length === 0)
     return res.status(200).json({ success: true, sent: 0 })

    const isNew     = type === 'product_new'
    const subject   = isNew
      ? `🌱 New item available: ${product.name} — Adarshini Organic Farm`
      : `✏️ Updated: ${product.name} — Adarshini Organic Farm`
    const banner    = isNew
      ? { color:'#2d6a27', icon:'🌱', text:'Fresh produce just added to the farm store!' }
      : { color:'#4a8c43', icon:'✏️', text:'Product details have been updated.' }

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e6;font-family:Arial,sans-serif">
  <div style="max-width:520px;margin:32px auto;background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #d8cfbc">
    <div style="background:${banner.color};padding:28px 32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">${banner.icon}</div>
      <div style="color:#fff;font-size:20px;font-weight:700">Adarshini Organic Farm</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">${banner.text}</div>
    </div>
    <div style="padding:28px 32px">
      <div style="background:#f5f0e6;border-radius:12px;padding:20px;text-align:center;margin-bottom:22px">
        <div style="font-size:52px;margin-bottom:10px">${product.emoji || '🌿'}</div>
        <div style="font-size:22px;font-weight:700;color:#1e2d1c;margin-bottom:6px">${product.name}</div>
        <div style="font-size:14px;color:#687165;margin-bottom:12px">${product.category || ''}</div>
        <div style="font-size:28px;font-weight:700;color:#2d6a27">
          ₹${product.price}<span style="font-size:14px;font-weight:400;color:#687165">/${product.unit}</span>
        </div>
        ${product.stock_quantity ? `<div style="margin-top:8px;font-size:12px;color:#2d6a27;font-weight:500">📦 ${product.stock_quantity} ${product.unit} available</div>` : ''}
        ${product.description ? `<div style="margin-top:12px;font-size:13px;color:#687165;line-height:1.6">${product.description}</div>` : ''}
      </div>
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}" 
        style="display:block;background:#2d6a27;color:#fff;text-align:center;padding:13px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600">
        Shop Now →
      </a>
      <p style="font-size:12px;color:#687165;text-align:center;margin-top:16px;line-height:1.6">
        You're receiving this because you registered at Adarshini Organic Farm.<br/>
        Visit our store to place your order.
      </p>
    </div>
    <div style="background:#f5f0e6;padding:16px 32px;text-align:center;font-size:12px;color:#687165;border-top:1px solid #d8cfbc">
      Adarshini Organic Farm 🌿 · Fresh from our fields
    </div>
  </div>
</body>
</html>`

    // Send to all customers — batch with small delay to respect rate limits
    const results = { sent: 0, failed: 0 }
    for (const email of product.emails) {
      try {
        await resend.emails.send({
          from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to:      email,
          subject,
          html,
        })
        results.sent++
        // Small delay between sends to avoid rate limiting
        await new Promise(r => setTimeout(r, 100))
      } catch (err) {
        console.error(`Failed to send to ${email}:`, err.message)
        results.failed++
      }
    }
    return res.status(200).json({ success: true, ...results })
  }

  // ── Order status notifications ─────────────────────────────────────────────
  if (!order) return res.status(400).json({ error: 'Missing order data' })

  const itemsHtml = (order.items || []).map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.emoji || ''} ${i.name}${i.selected_option ? ` (${i.selected_option})` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.qty} ${i.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">&#8377;${((i.effective_price ?? i.price) * i.qty).toFixed(2)}</td>
    </tr>`
  ).join('')

  const subjects = {
    confirmed:  `✅ Order Confirmed — Adarshini Organic Farm`,
    preparing:  `🌿 Your order is being packed — Adarshini Organic Farm`,
    delivering: `🚚 Out for delivery — Adarshini Organic Farm`,
    delivered:  `🎉 Order Delivered — Adarshini Organic Farm`,
    cancelled:  `❌ Order Cancelled — Adarshini Organic Farm`,
  }

  const banners = {
    confirmed:  { color:'#2d6a27', icon:'✅', text:'Your order is confirmed!' },
    preparing:  { color:'#4a8c43', icon:'🌿', text:'Your produce is being freshly packed.' },
    delivering: { color:'#b87d12', icon:'🚚', text:'On the way to you!' },
    delivered:  { color:'#2d6a27', icon:'🎉', text:'Delivered! Enjoy your fresh produce.' },
    cancelled:  { color:'#b83232', icon:'❌', text:'Your order has been cancelled.' },
  }

  const b = banners[type] || banners.confirmed

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f0e6;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #d8cfbc">
    <div style="background:${b.color};padding:28px 32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">${b.icon}</div>
      <div style="color:#fff;font-size:22px;font-weight:700">Adarshini Organic Farm</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">${b.text}</div>
    </div>
    <div style="padding:28px 32px">
      <p style="margin:0 0 6px;font-size:15px;color:#1e2d1c">Hi <strong>${order.customer_name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#687165">
        ${type === 'confirmed'  ? 'Thank you for your order! Here are your order details:' : ''}
        ${type === 'preparing'  ? 'Great news! We have started packing your fresh produce.' : ''}
        ${type === 'delivering' ? 'Your order is on its way. Please be available at the delivery address.' : ''}
        ${type === 'delivered'  ? 'Your order has been successfully delivered. We hope you love it!' : ''}
        ${type === 'cancelled'  ? `Unfortunately your order has been cancelled.${order.cancel_reason ? ` Reason: ${order.cancel_reason}` : ''} Please contact us if you have any questions.` : ''}
      </p>
      <div style="background:#f5f0e6;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <div style="font-size:12px;color:#687165;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">Order Summary</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e2d1c">
          <thead>
            <tr style="border-bottom:2px solid #d8cfbc">
              <th style="padding:6px 12px;text-align:left;font-weight:600">Item</th>
              <th style="padding:6px 12px;text-align:center;font-weight:600">Qty</th>
              <th style="padding:6px 12px;text-align:right;font-weight:600">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:10px 12px;font-weight:700;font-size:15px">Total</td>
              <td style="padding:10px 12px;text-align:right;font-weight:700;font-size:16px;color:#2d6a27">&#8377;${Number(order.total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div style="font-size:13px;color:#687165;line-height:1.8">
        <div><strong style="color:#1e2d1c">📍 Address:</strong> ${order.address}</div>
        <div><strong style="color:#1e2d1c">📞 Phone:</strong> ${order.phone}</div>
        <div><strong style="color:#1e2d1c">💳 Payment:</strong> ${order.payment_method === 'razorpay' ? 'Paid Online' : 'Cash on Delivery'}</div>
      </div>
    </div>
    <div style="background:#f5f0e6;padding:18px 32px;text-align:center;font-size:12px;color:#687165;border-top:1px solid #d8cfbc">
      Questions? Reply to this email or contact us. &nbsp;·&nbsp; Adarshini Organic Farm 🌿
    </div>
  </div>
</body>
</html>`

try {
  let ccEmails = []
const farmIds = [...new Set((order.items || []).map(i => i.farm_id).filter(Boolean))]
if (farmIds.length > 0) {
  const { createClient } = await import('@supabase/supabase-js')
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  const { data: farms } = await adminClient.from('farms')
    .select('email').in('id', farmIds)
  ccEmails = (farms || [])
    .map(f => f.email)
    .filter(e => e && e !== process.env.ADMIN_EMAIL)
}

    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to:      order.user_email,
      cc:      ccEmails.length > 0 ? ccEmails : undefined,
      subject: subjects[type] || subjects.confirmed,
      html,
    })
    if (error) throw error
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Resend error:', err)
    res.status(200).json({ success: false, warning: err.message })
  }

}
