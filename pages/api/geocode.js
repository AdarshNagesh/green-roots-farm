export default async function handler(req, res) {
  const { address } = req.query
  if (!address) return res.status(400).json({ error: 'Missing address' })
  
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
  const response = await fetch(url)
  const data = await response.json()
  
  if (data.status !== 'OK' || !data.results[0]) {
    return res.status(200).json({ found: false })
  }
  
  const { lat, lng } = data.results[0].geometry.location
  return res.status(200).json({ found: true, lat, lng,
    formatted: data.results[0].formatted_address })
}