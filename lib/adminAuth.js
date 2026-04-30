import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function requireAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  // Check admin email or role
  const adminEmail = process.env.ADMIN_EMAIL
  if (user.email !== adminEmail) {
    const { data: profile } = await admin.from('profiles')
      .select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') {
      res.status(403).json({ error: 'Forbidden' })
      return null
    }
  }
  return user
}