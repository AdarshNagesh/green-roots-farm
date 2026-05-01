import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/globals.css'

const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes — adjust as needed

export default function App({ Component, pageProps }) {

  // ── Idle logout — only runs when a session exists ──────────────────────
  useEffect(() => {
    let timer = null

    async function startTimer() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return  // no session = no timer needed

      clearTimeout(timer)
      timer = setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
      }, IDLE_TIMEOUT)
    }

    const events = ['mousemove', 'keypress', 'click', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, startTimer))
    startTimer()  // kick off on mount

    // Restart timer whenever auth state changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') startTimer()
      if (event === 'SIGNED_OUT') clearTimeout(timer)
    })

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, startTimer))
      subscription.unsubscribe()
    }
  }, [])

  // ── Prevent back button showing cached page after logout ───────────────
  useEffect(() => {
    window.history.pushState(null, '', window.location.href)
    window.onpopstate = () => {
      window.history.pushState(null, '', window.location.href)
    }
  }, [])

  return <Component {...pageProps} />
}
