import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { user_id, loyalty_enabled } = req.body
  if (!user_id || loyalty_enabled === undefined) return res.status(400).json({ error: 'Missing fields' })

  const { error } = await adminClient.from('profiles')
    .update({ loyalty_enabled })
    .eq('id', user_id)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ success: true })
}
