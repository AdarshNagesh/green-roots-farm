// ============================================================
// lib/deliveryUtils.js
// ============================================================
import { decode, isValid, isShort, recoverNearest } from 'open-location-code'

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
  const base   = parseFloat(settings.delivery_base_fee   || 20)
  const baseKm = parseFloat(settings.delivery_base_km    || 2)
  const perKm  = parseFloat(settings.delivery_per_km_fee || 8)
  const maxFee = parseFloat(settings.delivery_max_fee    || 80)
  const fee    = distanceKm <= baseKm
    ? base
    : base + (distanceKm - baseKm) * perKm
  return Math.min(parseFloat(fee.toFixed(2)), maxFee)
}

// Decode Plus Code to lat/lng
// refLat/refLng = Mysore city center (used to recover short codes)
export function decodePlusCode(code, refLat = 12.2958, refLng = 76.6394) {
  try {
    // Extract just the plus code part (before any space/comma)
    const clean = code.trim().split(/[\s,]/)[0].toUpperCase()
    if (!isValid(clean)) return null
    const fullCode = isShort(clean) ? recoverNearest(clean, refLat, refLng) : clean
    const { latitudeCenter, longitudeCenter } = decode(fullCode)
    return { lat: latitudeCenter, lng: longitudeCenter }
  } catch { return null }
}

// Geocode address using Nominatim (free, no API key)
export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=in`
  const res  = await fetch(url, { headers: { 'User-Agent': 'AdarshiniOrganicFarm/1.0' } })
  const data = await res.json()
  if (!data || data.length === 0) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}
