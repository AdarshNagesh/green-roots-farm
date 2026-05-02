import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  const { data: { user }, error: authErr } = await admin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Must be farm owner
  const { data: profile } = await admin.from('profiles')
    .select('role, owned_farm_id').eq('id', user.id).single()
  if (profile?.role !== 'farm_owner' || !profile.owned_farm_id)
    return res.status(403).json({ error: 'Not a farm owner' })

  const farmId = profile.owned_farm_id
  const { from, to, status } = req.query

  // Fetch orders for this farm only
  let query = admin.from('orders')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', new Date(from).toISOString())
  if (to) { const end = new Date(to); end.setHours(23,59,59,999); query = query.lte('created_at', end.toISOString()) }
  if (status && status !== 'All') query = query.eq('status', status)

  const { data: orders, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Fetch farm info
  const { data: farm } = await admin.from('farms')
    .select('name, owner_name, platform_fee').eq('id', farmId).single()
  const feePct = parseFloat(farm?.platform_fee || 0)

  // Build CSV rows
  const rows = []

  // Header
  rows.push([
    'Order ID', 'Date', 'Customer Name', 'Phone', 'Address',
    'Items', 'Order Total (₹)', 'Payment Method', 'Payment Status',
    'Order Status', 'Platform Fee %', 'Platform Fee (₹)',
    'Your Earnings (₹)', 'Points Redeemed', 'Notes'
  ].join(','))

  let totalRevenue = 0, totalFee = 0, totalNet = 0

  for (const o of orders) {
    const orderTotal = Number(o.total)
    const feeAmount  = parseFloat((orderTotal * feePct / 100).toFixed(2))
    const netPayable = parseFloat((orderTotal - feeAmount).toFixed(2))

    const itemsSummary = (o.items || [])
      .map(i => `${i.name}${i.selected_option ? ` (${i.selected_option})` : ''} x${i.qty}`)
      .join(' | ')

    rows.push([
      o.id.slice(0,8).toUpperCase(),
      new Date(o.created_at).toLocaleDateString('en-IN'),
      `"${(o.customer_name || '').replace(/"/g,'""')}"`,
      o.phone || '',
      `"${(o.address || '').replace(/"/g,'""')}"`,
      `"${itemsSummary.replace(/"/g,'""')}"`,
      orderTotal.toFixed(2),
      o.payment_method || '',
      o.payment_status || '',
      o.status || '',
      feePct.toFixed(2) + '%',
      feeAmount.toFixed(2),
      netPayable.toFixed(2),
      o.points_redeemed || 0,
      `"${(o.notes || '').replace(/"/g,'""')}"`,
    ].join(','))

    totalRevenue += orderTotal
    totalFee     += feeAmount
    totalNet     += netPayable
  }

  // Summary
  rows.push([])
  rows.push([`=== SUMMARY FOR ${(farm?.name || '').toUpperCase()} ===`])
  rows.push([`Total Orders,${orders.length}`])
  rows.push([`Gross Revenue (₹),${totalRevenue.toFixed(2)}`])
  rows.push([`Platform Fee (${feePct}%),${totalFee.toFixed(2)}`])
  rows.push([`Your Net Earnings (₹),${totalNet.toFixed(2)}`])

  const csv      = rows.map(r => Array.isArray(r) ? r.join(',') : r).join('\n')
  const filename = `orders-${(farm?.name || 'farm').replace(/\s+/g,'-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send('\uFEFF' + csv)
}
