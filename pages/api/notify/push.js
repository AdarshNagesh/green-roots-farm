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

  const secret = req.headers['x-internal-secret']
  const token  = req.headers.authorization?.replace('Bearer ', '')

  let authorized = false
  if (secret && secret === process.env.INTERNAL_API_SECRET) {
    authorized = true
  } else if (token) {
    const { data: { user } } = await admin.auth.getUser(token)
    if (user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
      authorized = true
    } else if (user) {
      // Also allow farm owners
      const { data: farm } = await admin.from('farms')
        .select('id').eq('owner_id', user.id).single()
      if (farm) authorized = true
    }
  }
  if (!authorized) {
    console.log('PUSH: unauthorized')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { user_id, title, body, url, tag } = req.body
  if (!user_id || !title || !body) return res.status(400).json({ error: 'Missing fields' })

  console.log('PUSH: user_id =', user_id)

  const { data: row } = await admin.from('push_subscriptions')
    .select('subscription').eq('user_id', user_id).single()

  console.log('PUSH: subscription found =', !!row?.subscription)

  if (!row?.subscription) return res.status(200).json({ ok: true, skipped: 'no subscription' })

  const payload = JSON.stringify({ title, body, url: url || '/orders', tag })

  try {
    await webpush.sendNotification(row.subscription, payload)
    console.log('PUSH: sent successfully')
    res.status(200).json({ ok: true })
  } catch (err) {
    console.log('PUSH: error =', err.message, 'status =', err.statusCode)
    if (err.statusCode === 410 || err.statusCode === 404) {
      await admin.from('push_subscriptions').delete().eq('user_id', user_id)
    }
    res.status(200).json({ ok: true, skipped: err.message })
  }
}
