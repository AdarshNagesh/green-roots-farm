import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend      = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = process.env.ADMIN_EMAIL
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { order } = req.body
  if (!order || !ADMIN_EMAIL) return res.status(200).json({ skipped: true })

  // Fetch farm owner email if order has farm_id
  // Get all unique farm IDs from order items
const farmIds = [...new Set((order.items || []).map(i => i.farm_id).filter(Boolean))]
let farms = []
if (farmIds.length > 0) {
  const { data } = await adminClient.from('farms')
    .select('email, name, id').in('id', farmIds)
  farms = data || []
}
const farmName = farms.length === 1 ? farms[0].name : 'Multiple Farms'

  const itemsHtml = (order.items || []).map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${i.name}${i.selected_option ? ` (${i.selected_option})` : ''}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${i.qty}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">Rs.${((i.effective_price ?? i.price) * i.qty).toFixed(0)}</td>
    </tr>`
  ).join('')

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e6;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:24px auto;background:#fffdf8;border-radius:14px;overflow:hidden;border:1px solid #d8cfbc">
  <div style="background:#2d6a27;padding:20px 28px">
    <div style="color:#fff;font-size:20px;font-weight:700">🌿 New Order Received!</div>
    <div style="color:rgba(255,255,255,0.8);font-size:13px;margin-top:3px">
      ${farmName ? farmName : 'Adarshini Organic Farm'}
    </div>
  </div>
  <div style="padding:24px 28px">
    <div style="background:#e8f3e6;border-radius:10px;padding:14px 16px;margin-bottom:18px">
      <div style="font-size:13px;color:#687165">Order #${(order.id||'').slice(0,8).toUpperCase()}</div>
      <div style="font-size:24px;font-weight:700;color:#2d6a27">Rs.${Number(order.total).toFixed(2)}</div>
      <div style="font-size:13px;color:#687165;margin-top:2px">${order.payment_method==='razorpay'?'Paid Online':'Cash on Delivery'}</div>
    </div>
    <div style="margin-bottom:16px;font-size:13px;color:#1e2d1c;line-height:1.8">
      <strong>${order.customer_name}</strong><br/>
      ${order.phone}<br/>
      ${order.address}
      ${order.notes ? `<br/><em>Note: ${order.notes}</em>` : ''}
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:18px">
      <thead><tr style="background:#f5f0e6">
        <th style="padding:8px 12px;text-align:left">Item</th>
        <th style="padding:8px 12px;text-align:center">Qty</th>
        <th style="padding:8px 12px;text-align:right">Amount</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
      <tfoot><tr>
        <td colspan="2" style="padding:10px 12px;font-weight:700">Total</td>
        <td style="padding:10px 12px;text-align:right;font-weight:700;color:#2d6a27">Rs.${Number(order.total).toFixed(2)}</td>
      </tr></tfoot>
    </table>
    ${order.delivery_type === 'delivery' ? `
<div style="margin-bottom:18px;padding:14px 16px;background:#fff8e6;border-radius:10px;
  border-left:4px solid #b87d12;font-size:13px;color:#7a5200;line-height:1.8">
  <strong>🚚 Delivery Order — Action Required</strong><br/>
  Please deliver your items to:<br/>
  <strong>Adarshini Organic Farm</strong><br/>
  before the scheduled delivery time so we can dispatch to the customer.
</div>` : `
<div style="margin-bottom:18px;padding:14px 16px;background:#e8f3e6;border-radius:10px;
  border-left:4px solid #2d6a27;font-size:13px;color:#1e4d1a;line-height:1.8">
  <strong>🏪 Pickup Order</strong><br/>
  Customer will collect directly from your farm.
</div>`}
    <div style="text-align:center">
      <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://adarshini.co.in'}/admin"
  style="background:#2d6a27;color:#fff;padding:11px 24px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600;display:inline-block">
  Open Admin Panel →
</a>
<br/><br/>
<a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://adarshini.co.in'}/farm-portal"
  style="background:#4a8c43;color:#fff;padding:11px 24px;border-radius:9px;text-decoration:none;font-size:14px;font-weight:600;display:inline-block">
  Open Farm Portal →
</a>
    </div>
  </div>
</div></body></html>`

  try {
    // Build recipients — always admin, plus farm owner if different
   const to = [ADMIN_EMAIL]
farms.forEach(f => {
  if (f.email && f.email !== ADMIN_EMAIL && !to.includes(f.email)) {
    to.push(f.email)
  }
})

    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to,
      subject: `New Order Rs.${Number(order.total).toFixed(0)} from ${order.customer_name}${farmName ? ` — ${farmName}` : ''}`,
      html,
    })
    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Admin notify error:', err)
    res.status(200).json({ success: false })
  }
}
