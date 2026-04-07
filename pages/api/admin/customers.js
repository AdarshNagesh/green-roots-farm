import { createClient } from '@supabase/supabase-js'

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  const { data, error } = await adminClient
    .from('profiles')
    .select('*')
    .eq('is_admin', false)
    .order('created_at', { ascending: false })
  if (error) return res.status(500).json({ error: error.message })
  res.status(200).json(data)
}
