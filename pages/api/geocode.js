import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
  try {
    if (req.method !== 'GET') return res.status(405).end()

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket?.remoteAddress ||
      'unknown'

    if (isRateLimited(ip)) {
      return res.status(429).json({
        found: false,
        error: 'Too many requests. Please wait a minute.'
      })
    }

    const { address } = req.query
    if (!address) {
      return res.status(400).json({
        found: false,
        error: 'Missing address'
      })
    }

    const cacheKey = address.toLowerCase().trim()

    // ✅ 1. Check cache
    try {
      const { data: cached, error } = await admin
        .from('geocode_cache')
        .select('lat, lng, formatted')
        .eq('address_key', cacheKey)
        .maybeSingle()

      if (!error && cached) {
        return res.status(200).json({
          found: true,
          lat: cached.lat,
          lng: cached.lng,
          formatted: cached.formatted,
          cached: true
        })
      }
    } catch (e) {
      console.error('Cache read failed:', e)
    }

    // ✅ 2. Call Google API
    if (!process.env.GOOGLE_MAPS_API_KEY) {
      throw new Error('Missing GOOGLE_MAPS_API_KEY')
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${process.env.GOOGLE_MAPS_API_KEY}`

    const response = await fetch(url)

    // 🔥 extra safety (important)
    if (!response.ok) {
      throw new Error(`Google API failed: ${response.status}`)
    }

    const data = await response.json()

    if (data.status !== 'OK' || !data.results?.[0]) {
      return res.status(200).json({
        found: false,
        status: data.status,
        error: data.error_message || 'Address not found'
      })
    }

    const { lat, lng } = data.results[0].geometry.location
    const formatted = data.results[0].formatted_address

    // ✅ 3. Save to cache (FIXED)
    try {
      await admin
        .from('geocode_cache')
        .upsert({
          address_key: cacheKey,
          lat,
          lng,
          formatted
        })
    } catch (e) {
      console.error('Cache write failed:', e)
      // do NOT fail request because of cache
    }

    // ✅ 4. Return success
    return res.status(200).json({
      found: true,
      lat,
      lng,
      formatted
    })

  } catch (err) {
    console.error('🔥 GEOCODE ERROR:', err)

    return res.status(500).json({
      found: false,
      error: err.message || 'Internal server error'
    })
  }
}
