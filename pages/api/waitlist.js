import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  const { method, body, query } = req

  // GET — check if user is on waitlist for a product
  if (method === 'GET') {
    const { user_id, product_id } = query
    if (!user_id || !product_id) return res.status(400).json({ error: 'Missing params' })
    const { data } = await supabaseAdmin.from('waitlist')
      .select('id').eq('user_id', user_id).eq('product_id', product_id).maybeSingle()
    return res.status(200).json({ on_waitlist: !!data })
  }

  // POST — add to waitlist
  if (method === 'POST') {
    const { user_id, user_email, product_id } = body
    if (!user_id || !user_email || !product_id) return res.status(400).json({ error: 'Missing fields' })
    const { error } = await supabaseAdmin.from('waitlist')
      .upsert({ user_id, user_email, product_id }, { onConflict: 'user_id,product_id', ignoreDuplicates: true })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  // DELETE — remove from waitlist
  if (method === 'DELETE') {
    const { user_id, product_id } = body
    if (!user_id || !product_id) return res.status(400).json({ error: 'Missing fields' })
    const { error } = await supabaseAdmin.from('waitlist')
      .delete().eq('user_id', user_id).eq('product_id', product_id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).end()
}
