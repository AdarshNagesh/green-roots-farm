import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { farm_id, action } = req.body // action: 'approve' | 'reject'
  if (!farm_id || !action) return res.status(400).json({ error: 'Missing fields' })

  const { data: farm } = await admin.from('farms').select('*').eq('id', farm_id).single()
  if (!farm) return res.status(404).json({ error: 'Farm not found' })

  if (action === 'approve') {
    // Approve farm
    await admin.from('farms').update({ is_approved: true, is_active: true }).eq('id', farm_id)
    // Update owner profile
    if (farm.owner_id) {
      await admin.from('profiles').update({
        role: 'farm_owner',
        owned_farm_id: farm_id,
      }).eq('id', farm.owner_id)
    }
    // Email owner
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL,
        to:      farm.owner_email || farm.email,
        subject: `✅ Your farm "${farm.name}" has been approved!`,
        html:    `<p>Hi ${farm.owner_name},</p>
                  <p>Great news! Your farm <strong>${farm.name}</strong> has been approved on Adarshini Organic Farm platform.</p>
                  <p>You can now login and start managing your products from the Farm Portal.</p>
                  <a href="${process.env.NEXT_PUBLIC_SITE_URL}/farm-portal" 
                     style="background:#2d6a27;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:12px">
                    Open Farm Portal →
                  </a>`,
      })
    } catch (e) { console.error('Email failed:', e) }

  } else if (action === 'reject') {
    // Soft delete — mark inactive and not approved
    await admin.from('farms').update({ is_approved: false, is_active: false }).eq('id', farm_id)
    // Reset profile role
    if (farm.owner_id) {
      await admin.from('profiles').update({ role: 'customer', owned_farm_id: null }).eq('id', farm.owner_id)
    }
    // Email owner
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from:    process.env.RESEND_FROM_EMAIL,
        to:      farm.owner_email || farm.email,
        subject: `Farm registration update — ${farm.name}`,
        html:    `<p>Hi ${farm.owner_name},</p>
                  <p>Unfortunately your farm registration for <strong>${farm.name}</strong> was not approved at this time.</p>
                  <p>Please contact us for more information.</p>`,
      })
    } catch (e) { console.error('Email failed:', e) }
  }

  return res.status(200).json({ success: true })
}
