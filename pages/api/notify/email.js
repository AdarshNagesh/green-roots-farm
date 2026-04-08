import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const { type, order } = req.body
  if (!order) return res.status(400).json({ error: 'Missing order data' })

  const itemsHtml = (order.items || []).map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.emoji} ${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.qty} ${i.unit}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">&#8377;${(i.price*i.qty).toFixed(2)}</td>
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
<body style="margin:0;padding:0;background:#f5f0e6;font-family:'DM Sans',Arial,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #d8cfbc">
    <!-- Header -->
    <div style="background:${b.color};padding:28px 32px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">${b.icon}</div>
      <div style="color:#fff;font-size:22px;font-weight:700">Adarshini Organic Farm</div>
      <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">${b.text}</div>
    </div>
    <!-- Body -->
    <div style="padding:28px 32px">
      <p style="margin:0 0 6px;font-size:15px;color:#1e2d1c">Hi <strong>${order.customer_name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#687165">
        ${type === 'confirmed'  ? 'Thank you for your order! Here are your order details:' : ''}
        ${type === 'preparing'  ? 'Great news! We have started packing your fresh produce.' : ''}
        ${type === 'delivering' ? 'Your order is on its way. Please be available at the delivery address.' : ''}
        ${type === 'delivered'  ? 'Your order has been successfully delivered. We hope you love it!' : ''}
        ${type === 'cancelled'  ? 'Unfortunately your order has been cancelled. Please contact us if you have any questions.' : ''}
      </p>

      <!-- Order summary -->
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

      <!-- Delivery details -->
      <div style="font-size:13px;color:#687165;line-height:1.8">
        <div><strong style="color:#1e2d1c">📍 Address:</strong> ${order.address}</div>
        <div><strong style="color:#1e2d1c">📞 Phone:</strong> ${order.phone}</div>
        <div><strong style="color:#1e2d1c">💳 Payment:</strong> ${order.payment_method === 'razorpay' ? 'Paid Online' : 'Cash on Delivery'}</div>
      </div>
    </div>
    <!-- Footer -->
    <div style="background:#f5f0e6;padding:18px 32px;text-align:center;font-size:12px;color:#687165;border-top:1px solid #d8cfbc">
      Questions? Reply to this email or call us. &nbsp;·&nbsp; Adarshini Organic Farm 🌿
    </div>
  </div>
</body>
</html>`

  try {
    const { error } = await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to:      order.user_email,
      subject: subjects[type] || subjects.confirmed,
      html,
    })
    if (error) throw error
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Resend error:', err)
    // Non-blocking — don't fail the order
    res.status(200).json({ success: false, warning: err.message })
  }
}
