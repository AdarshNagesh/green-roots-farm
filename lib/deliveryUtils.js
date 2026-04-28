// ============================================================
// lib/deliveryUtils.js
// Haversine distance + fee calculation
// ============================================================

// Haversine formula — straight-line distance in km
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Calculate fee based on admin settings
export function calcDeliveryFee(distanceKm, settings) {
  const base   = parseFloat(settings.delivery_base_fee  || 20)
  const baseKm = parseFloat(settings.delivery_base_km   || 2)
  const perKm  = parseFloat(settings.delivery_per_km_fee || 8)
  const maxFee = parseFloat(settings.delivery_max_fee   || 80)
  const fee    = distanceKm <= baseKm
    ? base
    : base + (distanceKm - baseKm) * perKm
  return Math.min(parseFloat(fee.toFixed(2)), maxFee)
}

// Geocode address using Nominatim (free, no API key)
export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`
  const res  = await fetch(url, { headers: { 'User-Agent': 'AdarshiniOrganicFarm/1.0' } })
  const data = await res.json()
  if (!data || data.length === 0) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name }
}

// Plus Code decoder (Open Location Code spec)
export function decodePlusCode(code) {
  const CODE_ALPHABET = '23456789CFGHJMPQRVWX'
  const clean = code.replace(/\+/, '').toUpperCase()
  const full = clean.length >= 8 ? clean : null
  if (!full) return null
  try {
    let lat = -90, lng = -180
    let latPlace = 20, lngPlace = 20
    for (let i = 0; i < Math.min(full.length, 10); i += 2) {
      const latIdx = CODE_ALPHABET.indexOf(full[i])
      const lngIdx = CODE_ALPHABET.indexOf(full[i + 1])
      if (latIdx < 0 || lngIdx < 0) return null
      latPlace /= 20; lngPlace /= 20
      lat += latIdx * latPlace * 20
      lng += lngIdx * lngPlace * 20
    }
    return { lat: lat + latPlace * 10, lng: lng + lngPlace * 10 }
  } catch { return null }
}
