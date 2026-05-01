import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const admin  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user } } = await admin.auth.getUser(token)
  if (user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL)
    return res.status(401).json({ error: 'Unauthorized' })

  const { product_id, product_name, product_price, product_unit } = req.body
  if (!product_id) return res.status(400).json({ error: 'Missing product_id' })

  // Fetch all waitlisted users for this product
  const { data: waitlist } = await admin.from('waitlist')
    .select('user_id, user_email').eq('product_id', product_id)
  if (!waitlist?.length) return res.status(200).json({ ok: true, notified: 0 })

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://adarshini.co.in'

  await Promise.allSettled(waitlist.map(async w => {
    // 1. Bell notification
    await admin.from('notifications').insert({
      user_id: w.user_id,
      message: `✅ ${product_name} is back in stock! Order now before it runs out.`,
      type:    'product',
    })

    // 2. Email
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to:      w.user_email,
      subject: `🌿 ${product_name} is back in stock — Adarshini Organic Farm`,
      html: `
<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e6;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:32px auto;background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #d8cfbc">
  <div style="background:#2d6a27;padding:28px 32px;text-align:center">
    <div style="font-size:40px;margin-bottom:8px">🌿</div>
    <div style="color:#fff;font-size:20px;font-weight:700">Back in Stock!</div>
    <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">You asked us to notify you</div>
  </div>
  <div style="padding:28px 32px;text-align:center">
    <div style="font-size:22px;font-weight:700;color:#1e2d1c;margin-bottom:8px">${product_name}</div>
    ${product_price ? `<div style="font-size:26px;font-weight:700;color:#2d6a27">₹${product_price}<span style="font-size:14px;font-weight:400;color:#687165">/${product_unit}</span></div>` : ''}
    <div style="margin:20px 0;font-size:14px;color:#687165;line-height:1.6">
      Great news! This product is now available again.<br/>Order soon — stock is limited.
    </div>
    <a href="${siteUrl}" style="display:inline-block;background:#2d6a27;color:#fff;padding:13px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600">
      Order Now →
    </a>
  </div>
  <div style="background:#f5f0e6;padding:16px 32px;text-align:center;font-size:12px;color:#687165;border-top:1px solid #d8cfbc">
    Adarshini Organic Farm 🌿 · You requested this notification
  </div>
</div>
</body></html>`,
    })

    // 3. Push
    const { data: sub } = await admin.from('push_subscriptions')
      .select('user_id').eq('user_id', w.user_id).single()
    if (sub) {
      await fetch(`${siteUrl}/api/notify/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({
          user_id: w.user_id,
          title:   'Adarshini Farm 🌿',
          body:    `${product_name} is back in stock! Order now.`,
          url:     '/',
          tag:     'restock-' + product_id,
        }),
      })
    }
  }))

  // Clear waitlist for this product — they've been notified
  await admin.from('waitlist').delete().eq('product_id', product_id)

  res.status(200).json({ ok: true, notified: waitlist.length })
}
