import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const { user_id } = req.query
  if (!user_id) return res.status(400).json({ error: 'Missing user_id' })

  const { data, error } = await admin.from('profiles')
  .select('points_balance, referral_code, referred_by, loyalty_enabled')
  .eq('id', user_id).single()
  if (error) return res.status(500).json({ error: error.message })

  const { data: transactions } = await admin.from('credit_transactions')
    .select('*').eq('user_id', user_id)
    .order('created_at', { ascending: false }).limit(20)

 res.status(200).json({
  points_balance:  data?.points_balance || 0,
  referral_code:   data?.referral_code || '',
  referred_by:     data?.referred_by || null,
  loyalty_enabled: data?.loyalty_enabled || false,
  transactions:    transactions || [],
})
}
