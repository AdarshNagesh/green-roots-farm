import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || ''

export const isAdmin = (user) => user?.email === ADMIN_EMAIL

// Instead of email check, use profile role
export async function isAdminUser(userId) {
  const { data } = await supabase.from('profiles')
    .select('role').eq('id', userId).single()
  return data?.role === 'admin'
}
