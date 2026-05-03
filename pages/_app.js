import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import '../styles/globals.css'

const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export default function App({ Component, pageProps }) {

  const [installPrompt, setInstallPrompt] = useState(null)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showIOSBanner, setShowIOSBanner] = useState(false)

  // ── Register Service Worker ──────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registered:', reg.scope)
    }).catch(err => console.error('SW failed:', err))
  }, [])

  // ── Request Push Permission after login ──────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await requestPushPermission(session.access_token)
      }
      if (event === 'SIGNED_OUT') {
        try {
          const reg = await navigator.serviceWorker.ready
          const sub = await reg.pushManager.getSubscription()
          if (sub) await sub.unsubscribe()
        } catch {}
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Install prompt (Android Chrome "Add to Home Screen") ─────────────────
  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault()
      setInstallPrompt(e)
      if (!window.matchMedia('(display-mode: standalone)').matches) {
        setShowInstallBanner(true)
      }
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  // ── iOS install prompt (Safari doesn't fire beforeinstallprompt) ──────────
  useEffect(() => {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const dismissed = sessionStorage.getItem('ios_banner_dismissed')
    if (isIOS && !isStandalone && !dismissed) {
      setTimeout(() => setShowIOSBanner(true), 3000) // show after 3s
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setShowInstallBanner(false)
    setInstallPrompt(null)
  }

  // ── Idle logout ──────────────────────────────────────────────────────────
  useEffect(() => {
    let timer = null

    async function startTimer() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await supabase.auth.signOut()
        window.location.href = '/'
      }, IDLE_TIMEOUT)
    }

    const events = ['mousemove', 'keypress', 'click', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, startTimer))
    startTimer()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN')  startTimer()
      if (event === 'SIGNED_OUT') clearTimeout(timer)
    })

    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, startTimer))
      subscription.unsubscribe()
    }
  }, [])

  return (
    <>
      <Component {...pageProps} />

      {/* Android Install Banner */}
      {showInstallBanner && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fff', borderTop: '1px solid #d8cfbc',
          padding: '14px 20px', display: 'flex', alignItems: 'center',
          gap: 12, boxShadow: '0 -4px 20px rgba(0,0,0,0.12)',
        }}>
          <span style={{ fontSize: 28 }}>🌿</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: '#1e2d1c' }}>
              Install Adarshini Farm
            </div>
            <div style={{ fontSize: 12, color: '#687165' }}>
              Get order updates even when app is closed
            </div>
          </div>
          <button onClick={handleInstall}
            style={{
              background: '#2d6a27', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>
            Install
          </button>
          <button onClick={() => setShowInstallBanner(false)}
            style={{
              background: 'transparent', border: 'none', fontSize: 18,
              cursor: 'pointer', color: '#687165', padding: '4px 8px',
            }}>
            ✕
          </button>
        </div>
      )}

      {/* iOS Install Instructions Banner */}
      {showIOSBanner && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: '#fff', borderTop: '2px solid #2d6a27',
          padding: '16px 20px', boxShadow: '0 -4px 20px rgba(0,0,0,0.15)',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>🌿</span>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1e2d1c' }}>
                Install Adarshini Farm
              </div>
            </div>
            <button onClick={() => {
              setShowIOSBanner(false)
              sessionStorage.setItem('ios_banner_dismissed', '1')
            }} style={{
              background: 'transparent', border: 'none', fontSize: 18,
              cursor: 'pointer', color: '#687165', padding: '0 4px',
            }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: '#687165', lineHeight: 1.8 }}>
            Add this app to your home screen for quick access and order notifications:
          </div>
          <div style={{ display:'flex', gap: 8, marginTop: 10, flexWrap:'wrap' }}>
            {[
              
              { step: '1', text: 'Tap Share ⬆️ at bottom of Safari', icon: '1️⃣' },
              { step: '2', text: 'Scroll & tap "Add to Home Screen"', icon: '2️⃣' },
              { step: '3', text: 'Tap "Add" at top right', icon: '3️⃣' },
            ].map(s => (
              <div key={s.step} style={{
                display:'flex', alignItems:'center', gap: 6,
                background:'#f5f0e6', borderRadius: 8, padding:'6px 10px',
                fontSize: 12, color: '#1e2d1c', fontWeight: 500,
              }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                {s.text}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#687165', marginTop: 8 }}>
            💡 Use Safari browser for best experience on iPhone
          </div>
        </div>
      )}
    </>
  )
}

async function requestPushPermission(accessToken) {
  try {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return
    if (Notification.permission === 'denied') return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) { await saveSubscription(existing, accessToken); return }

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) return

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    })
    await saveSubscription(subscription, accessToken)
  } catch (err) { console.error('Push permission error:', err) }
}

async function saveSubscription(subscription, accessToken) {
  try {
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify({ subscription }),
    })
  } catch {}
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
