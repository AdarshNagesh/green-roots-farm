import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/globals.css'

const IDLE_TIMEOUT = 5 * 60 * 1000 // 5 minutes

export default function App({ Component, pageProps }) {
  useEffect(() => {
    let timer

    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
      }, IDLE_TIMEOUT)
    }

    const events = ['mousemove', 'keypress', 'click', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset))
    reset()

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [])

  return <Component {...pageProps} />
}
