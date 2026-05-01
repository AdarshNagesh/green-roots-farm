import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return res.status(401).json({ error: 'Unauthorized' })

  // GET — list all subscribed user_ids (admin or farm owner)
  if (req.method === 'GET') {
    const isAdminUser = user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
    if (!isAdminUser) {
      const { data: profile } = await admin.from('profiles')
        .select('role').eq('id', user.id).single()
      if (profile?.role !== 'farm_owner')
        return res.status(401).json({ error: 'Unauthorized' })
    }
    const { data } = await admin.from('push_subscriptions').select('user_id')
    return res.status(200).json({ data: data || [] })
  }

  // POST — save subscription
  if (req.method === 'POST') {
    const { subscription } = req.body
    if (!subscription) return res.status(400).json({ error: 'Missing subscription' })
    const { error: upsertErr } = await admin.from('push_subscriptions').upsert({
      user_id:      user.id,
      endpoint:     subscription.endpoint,
      subscription: subscription,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (upsertErr) return res.status(500).json({ error: upsertErr.message })
    return res.status(200).json({ ok: true })
  }

  // DELETE — remove subscription on logout
  if (req.method === 'DELETE') {
    await admin.from('push_subscriptions').delete().eq('user_id', user.id)
    return res.status(200).json({ ok: true })
  }

  res.status(405).end()
}
