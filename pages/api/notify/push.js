import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

webpush.setVapidDetails(
  `mailto:${process.env.RESEND_FROM_EMAIL || 'hello@adarshini.co.in'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Internal calls only
  const secret = req.headers['x-internal-secret']
  if (!secret || secret !== process.env.INTERNAL_API_SECRET)
    return res.status(401).json({ error: 'Unauthorized' })

  const { user_id, title, body, url, tag } = req.body
  if (!user_id || !title || !body) return res.status(400).json({ error: 'Missing fields' })

  // Fetch stored subscription for this user
  const { data: row } = await admin.from('push_subscriptions')
    .select('subscription').eq('user_id', user_id).single()

  if (!row?.subscription) return res.status(200).json({ ok: true, skipped: 'no subscription' })

  const payload = JSON.stringify({ title, body, url: url || '/orders', tag })

  try {
    await webpush.sendNotification(row.subscription, payload)
    res.status(200).json({ ok: true })
  } catch (err) {
    // Subscription expired or invalid — remove it
    if (err.statusCode === 410 || err.statusCode === 404) {
      await admin.from('push_subscriptions').delete().eq('user_id', user_id)
    }
    res.status(200).json({ ok: true, skipped: err.message })
  }
}
