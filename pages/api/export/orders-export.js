import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { from, to, status } = req.query

  let query = adminClient.from('orders').select('*').order('created_at', { ascending: false })
  if (from)                  query = query.gte('created_at', new Date(from).toISOString())
  if (to) {
    const end = new Date(to); end.setHours(23,59,59,999)
    query = query.lte('created_at', end.toISOString())
  }
  if (status && status !== 'All') query = query.eq('status', status)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const rows = []
  rows.push([
    'Order ID','Date','Customer Name','Email','Phone','Address',
    'Items','Total (Rs.)','Status','Payment Method','Payment Status','Notes'
  ].join(','))

  for (const o of data) {
    const itemsSummary = (o.items || [])
      .map(i => `${i.name}${i.selected_option ? ` (${i.selected_option})` : ''} x${i.qty}`)
      .join(' | ')
    rows.push([
      o.id.slice(0,8).toUpperCase(),
      new Date(o.created_at).toLocaleDateString('en-IN'),
      `"${(o.customer_name || '').replace(/"/g,'""')}"`,
      o.user_email || '',
      o.phone || '',
      `"${(o.address || '').replace(/"/g,'""')}"`,
      `"${itemsSummary.replace(/"/g,'""')}"`,
      Number(o.total).toFixed(2),
      o.status || '',
      o.payment_method || '',
      o.payment_status || '',
      `"${(o.notes || '').replace(/"/g,'""')}"`,
    ].join(','))
  }

  const csv      = rows.join('\n')
  const filename = `adarshini-orders-${new Date().toISOString().split('T')[0]}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.status(200).send('\uFEFF' + csv)  // BOM for Excel compatibility
}
