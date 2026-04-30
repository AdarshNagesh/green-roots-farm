import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// In-memory rate limiter — 10 requests per IP per minute
const rateLimitMap = new Map()

function isRateLimited(ip) {
  const now = Date.now()
  const windowMs = 60 * 1000
  const maxRequests = 10

  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, start: now })
    return false
  }
  const entry = rateLimitMap.get(ip)
  if (now - entry.start > windowMs) {
    rateLimitMap.set(ip, { count: 1, start: now })
    return false
  }
  if (entry.count >= maxRequests) return true
  entry.count++
  return false
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress
  if (isRateLimited(ip)) {
    return res.status(429).json({ found: false, error: 'Too many requests. Please wait a minute.' })
  }

  // Require logged-in user
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ found: false, error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ found: false, error: 'Unauthorized' })

  const { address } = req.query
  if (!address) return res.status(400).json({ error: 'Missing address' })

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  const response = await fetch(url)
  const data = await response.json()

  console.log('Geocode status:', data.status)
  if (data.error_message) console.log('Geocode error:', data.error_message)

  if (data.status !== 'OK' || !data.results[0]) {
    return res.status(200).json({ found: false, status: data.status, error: data.error_message })
  }

  const { lat, lng } = data.results[0].geometry.location
  return res.status(200).json({
    found: true, lat, lng,
    formatted: data.results[0].formatted_address
  })
}
