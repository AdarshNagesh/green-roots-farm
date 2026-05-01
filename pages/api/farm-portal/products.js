import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { data: profile } = await admin.from('profiles')
    .select('role, owned_farm_id').eq('id', user.id).single()
  if (profile?.role !== 'farm_owner' || !profile.owned_farm_id)
    return res.status(403).json({ error: 'Not a farm owner' })

  const farmId = profile.owned_farm_id

  if (req.method === 'POST') {
    const payload = {
      ...req.body,
      farm_id:          farmId,
      is_visible:       false,
      pending_approval: true,
    }
    const { data, error } = await admin.from('products').insert(payload).select().single()
    if (error) return res.status(500).json({ error: error.message })

    try {
      const { data: farm } = await admin.from('farms').select('name').eq('id', farmId).single()
      const { data: adminProfile } = await admin.from('profiles').select('id').eq('role', 'admin').single()
      if (adminProfile?.id) {
        await admin.from('notifications').insert({
          user_id: adminProfile.id,
          message: `New product "${payload.name}" submitted by ${farm?.name || 'a farm'} — pending your approval.`,
          type: 'admin',
        })
      }

      // Email to admin
      const adminEmail = process.env.ADMIN_EMAIL
      if (adminEmail) {
        const { Resend } = await import('resend')
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
          to:   adminEmail,
          subject: `🌿 New product pending approval — ${payload.name}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;background:#f5f0e6;padding:32px">
              <div style="background:#fff;border-radius:16px;padding:28px">
                <div style="font-size:24px;font-weight:700;color:#2d6a27;margin-bottom:8px">🌿 New Product Submitted</div>
                <p style="color:#687165;font-size:14px">A new product has been submitted for your approval.</p>
                <div style="background:#f5f0e6;border-radius:10px;padding:16px;margin:16px 0">
                  <div style="font-weight:700;font-size:16px;color:#1e2d1c">${payload.name}</div>
                  <div style="color:#687165;font-size:13px;margin-top:4px">Farm: ${farm?.name || 'Unknown'}</div>
                  <div style="color:#2d6a27;font-weight:600;font-size:15px;margin-top:4px">₹${payload.price} / ${payload.unit}</div>
                  ${payload.description ? `<div style="color:#687165;font-size:13px;margin-top:6px">${payload.description}</div>` : ''}
                </div>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin" 
                  style="display:block;background:#2d6a27;color:#fff;text-align:center;padding:12px;border-radius:10px;text-decoration:none;font-size:14px;font-weight:600">
                  Review in Admin Panel →
                </a>
              </div>
            </div>
          `,
        })
      }
    } catch(e) { console.error('Admin notify failed:', e) }

    return res.status(200).json(data)
  }

  if (req.method === 'PUT') {
    const { id, ...payload } = req.body
    const { data: existing } = await admin.from('products').select('farm_id').eq('id', id).single()
    if (existing?.farm_id !== farmId) return res.status(403).json({ error: 'Not your product' })
    delete payload.is_visible
    delete payload.pending_approval
    const { error } = await admin.from('products').update(payload).eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  if (req.method === 'DELETE') {
    const { id } = req.body
    const { data: existing } = await admin.from('products').select('farm_id').eq('id', id).single()
    if (existing?.farm_id !== farmId) return res.status(403).json({ error: 'Not your product' })
    const { data: orders } = await admin.from('orders')
      .select('id, items').eq('farm_id', farmId).neq('status', 'Cancelled')
    const hasActiveOrder = (orders || []).some(o =>
      (o.items || []).some(item => item.id === id)
    )
    if (hasActiveOrder) return res.status(400).json({ error: 'Cannot delete — product has active orders. Mark as hidden instead.' })
    await admin.from('products').delete().eq('id', id)
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
