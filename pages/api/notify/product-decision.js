import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { decision, productName, reason, farmEmail, farmName } = req.body
  if (!farmEmail || !decision || !productName)
    return res.status(400).json({ error: 'Missing fields' })

  const approved = decision === 'approved'
  const subject  = approved
    ? `Your product "${productName}" has been approved!`
    : `Your product "${productName}" was not approved`

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f5f0e6;font-family:Arial,sans-serif">
      <div style="max-width:520px;margin:32px auto;background:#fffdf8;border-radius:16px;overflow:hidden;border:1px solid #d8cfbc">
        <div style="background:${approved ? '#2d6a27' : '#b83232'};padding:28px 32px;text-align:center">
          <div style="font-size:40px;margin-bottom:8px">${approved ? '✅' : '❌'}</div>
          <div style="color:#fff;font-size:20px;font-weight:700">Adarshini Organic Farm</div>
          <div style="color:rgba(255,255,255,0.85);font-size:14px;margin-top:4px">
            ${approved ? 'Product Approved!' : 'Product Not Approved'}
          </div>
        </div>
        <div style="padding:28px 32px">
          <p style="color:#687165;font-size:14px;margin-top:0">Hi ${farmName || 'there'},</p>

          ${approved
            ? `<p style="color:#1e2d1c;font-size:15px;line-height:1.7">
                Great news! Your product <strong>${productName}</strong> has been reviewed and approved.
                It is now <strong>live on the Adarshini shop</strong> and customers can see and order it.
               </p>`
            : `<p style="color:#1e2d1c;font-size:15px;line-height:1.7">
                Thank you for submitting <strong>${productName}</strong>.
                Unfortunately, it has not been approved at this time.
               </p>`
          }

          ${!approved && reason ? `
            <div style="background:#fef3f3;border-radius:10px;padding:16px 20px;margin:20px 0;border-left:4px solid #b83232">
              <div style="font-weight:700;font-size:13px;color:#b83232;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Reason:</div>
              <div style="color:#1e2d1c;font-size:14px;line-height:1.6">${reason}</div>
            </div>
            <p style="color:#687165;font-size:13px;line-height:1.6">
              Please make the necessary changes and resubmit your product from the Farm Portal.
            </p>
          ` : ''}

          <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://adarshini.co.in'}/farm-portal"
            style="display:block;background:#2d6a27;color:#fff;text-align:center;padding:13px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;margin-top:24px">
            Go to Farm Portal →
          </a>

          <p style="font-size:12px;color:#687165;text-align:center;margin-top:20px;line-height:1.6">
            If you have any questions, please contact us at ${process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'support@adarshini.co.in'}
          </p>
        </div>
        <div style="background:#f5f0e6;padding:16px 32px;text-align:center;font-size:12px;color:#687165;border-top:1px solid #d8cfbc">
          Adarshini Organic Farm · Mysore, Karnataka
        </div>
      </div>
    </body>
    </html>
  `

  try {
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to:      farmEmail,
      subject,
      html,
    })
    return res.status(200).json({ success: true })
  } catch (e) {
    console.error('Product decision email failed:', e)
    return res.status(500).json({ error: e.message })
  }
}
