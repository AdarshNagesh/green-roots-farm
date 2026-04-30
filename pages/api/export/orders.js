import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '../../../lib/adminAuth'
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const adminUser = await requireAdmin(req, res)
if (!adminUser) return
  if (req.method !== 'GET') return res.status(405).end()

  const { from, to, status, farm_id } = req.query

  // Fetch orders
  let query = adminClient.from('orders').select('*').order('created_at', { ascending: false })
  if (from)                       query = query.gte('created_at', new Date(from).toISOString())
  if (to) { const end = new Date(to); end.setHours(23,59,59,999); query = query.lte('created_at', end.toISOString()) }
  if (status && status !== 'All') query = query.eq('status', status)
  if (farm_id && farm_id !== 'All') query = query.eq('farm_id', farm_id)

  const { data: orders, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Fetch all farms for lookup
  const { data: farms } = await adminClient.from('farms').select('id, name, owner_name, email, platform_fee')
  const farmMap = Object.fromEntries((farms||[]).map(f => [f.id, f]))

  // ── Build rows ──
  const rows = []

  // Header
  rows.push([
    'Order ID', 'Date', 'Farm', 'Farm Owner', 'Customer Name', 'Email', 'Phone', 'Address',
    'Items', 'Order Total (₹)', 'Payment Method', 'Payment Status', 'Order Status',
    'Platform Fee %', 'Platform Fee (₹)', 'Net Payable to Farm (₹)',
    'Points Redeemed', 'Notes'
  ].join(','))

  // Per-farm summary accumulators
  const farmSummary = {}

  for (const o of orders) {
    const farm        = farmMap[o.farm_id] || {}
    const farmName    = farm.name        || 'Unknown'
    const ownerName   = farm.owner_name  || ''
    const feePct      = parseFloat(farm.platform_fee || 0)
    const orderTotal  = Number(o.total)
    const feeAmount   = parseFloat((orderTotal * feePct / 100).toFixed(2))
    const netPayable  = parseFloat((orderTotal - feeAmount).toFixed(2))

    const itemsSummary = (o.items || [])
      .map(i => `${i.name}${i.selected_option ? ` (${i.selected_option})` : ''} x${i.qty}`)
      .join(' | ')

    rows.push([
      o.id.slice(0,8).toUpperCase(),
      new Date(o.created_at).toLocaleDateString('en-IN'),
      `"${farmName}"`,
      `"${ownerName}"`,
      `"${(o.customer_name || '').replace(/"/g,'""')}"`,
      o.user_email || '',
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

    // Accumulate per farm
    if (!farmSummary[o.farm_id || 'unknown']) {
      farmSummary[o.farm_id || 'unknown'] = {
        name: farmName, owner: ownerName, email: farm.email || '',
        feePct, orders: 0, totalRevenue: 0, totalFee: 0, totalNet: 0
      }
    }
    const fs = farmSummary[o.farm_id || 'unknown']
    fs.orders++
    fs.totalRevenue += orderTotal
    fs.totalFee     += feeAmount
    fs.totalNet     += netPayable
  }

  // ── Summary section ──
  rows.push([])
  rows.push(['=== FARM SUMMARY ==='].join(','))
  rows.push(['Farm', 'Owner', 'Email', 'Total Orders', 'Gross Revenue (₹)', 'Platform Fee %', 'Platform Fee (₹)', 'Net Payable to Farm (₹)'].join(','))

  for (const fs of Object.values(farmSummary)) {
    rows.push([
      `"${fs.name}"`,
      `"${fs.owner}"`,
      fs.email,
      fs.orders,
      fs.totalRevenue.toFixed(2),
      fs.feePct.toFixed(2) + '%',
      fs.totalFee.toFixed(2),
      fs.totalNet.toFixed(2),
    ].join(','))
  }

  // Grand total
  const grandRevenue = Object.values(farmSummary).reduce((s, f) => s + f.totalRevenue, 0)
  const grandFee     = Object.values(farmSummary).reduce((s, f) => s + f.totalFee, 0)
  const grandNet     = Object.values(farmSummary).reduce((s, f) => s + f.totalNet, 0)
  rows.push([])
  rows.push([
    '"GRAND TOTAL"', '', '',
    orders.length,
    grandRevenue.toFixed(2),
    '',
    grandFee.toFixed(2),
    grandNet.toFixed(2),
  ].join(','))

  const csv      = rows.map(r => Array.isArray(r) ? r.join(',') : r).join('\n')
  const filename = `adarshini-orders-${new Date().toISOString().split('T')[0]}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send('\uFEFF' + csv)
}
