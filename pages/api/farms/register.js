import { createClient } from '@supabase/supabase-js'
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const registerRateLimit = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000 // 1 hour
  const maxRequests = 3 // max 3 registrations per IP per hour

  if (!registerRateLimit.has(ip)) {
    registerRateLimit.set(ip, { count: 1, start: now })
    return false
  }
  const entry = registerRateLimit.get(ip)
  if (now - entry.start > windowMs) {
    registerRateLimit.set(ip, { count: 1, start: now })
    return false
  }
  if (entry.count >= maxRequests) return true
  entry.count++
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress
if (isRateLimited(ip)) {
  return res.status(429).json({ error: 'Too many registration attempts. Please try again later.' })
}
  
  const { name, owner_name, email, phone, upi_id, description, city, owner_id,
          address, plus_code, pickup_instructions, lat, lng } = req.body
  if (!name || !owner_name || !email || !owner_id)
    return res.status(400).json({ error: 'Missing required fields' })
  const { data: existing } = await admin.from('farms')
    .select('id, is_approved').eq('owner_id', owner_id).single()
  if (existing) {
    if (existing.is_approved) return res.status(400).json({ error: 'You already have an approved farm.' })
    return res.status(400).json({ error: 'Your farm registration is already pending approval.' })
  }
  
  const { data: farm, error } = await admin.from('farms').insert({
    name, owner_name, email,
    phone:                phone || '',
    upi_id:               upi_id || '',
    description:          description || '',
    city:                 city || 'Mysore',
    address:              address || null,
    plus_code:            plus_code || null,
    pickup_instructions:  pickup_instructions || null,
    lat:                  lat || null,
    lng:                  lng || null,
    owner_id,
    owner_email:          email,
    is_approved:          false,
    is_active:            false,
    platform_fee:         0,
  }).select().single()
  if (error) return res.status(500).json({ error: error.message })
  await admin.from('profiles').update({ role: 'farm_owner_pending' }).eq('id', owner_id)
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL,
      to:      process.env.ADMIN_EMAIL,
      subject: `🚜 New Farm Registration: ${name}`,
      html:    `<p><strong>${owner_name}</strong> (${email}) has registered a new farm: <strong>${name}</strong>.</p>
                ${address ? `<p>📍 ${address}</p>` : ''}
                ${plus_code ? `<p>🔷 Plus Code: ${plus_code}</p>` : ''}
                <p>Login to Admin → Farms tab to approve or reject.</p>
                <a href="${process.env.NEXT_PUBLIC_SITE_URL}/admin">Open Admin Panel</a>`,
    })
  } catch (e) { console.error('Admin notify failed:', e) }
  return res.status(200).json({ success: true })
}
