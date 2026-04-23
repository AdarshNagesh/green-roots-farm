import { useState, useEffect } from 'react'
import { useRouter }           from 'next/router'
import Head                    from 'next/head'
import { supabase }            from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [success, setSuccess]       = useState(false)
  const [validSession, setValidSession] = useState(false)
  const [checking, setChecking]     = useState(true)

  useEffect(() => {
    // Supabase puts the access token in the URL hash after redirect
    // onAuthStateChange fires with event PASSWORD_RECOVERY when the link is valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setValidSession(true)
        setChecking(false)
      } else if (event === 'SIGNED_IN' && session) {
        setValidSession(true)
        setChecking(false)
      }
    })

    // Also check if we already have a session (page reload case)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { setValidSession(true); setChecking(false) }
      else {
        // Give the auth state change a moment to fire
        setTimeout(() => setChecking(false), 2000)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleReset() {
    setError('')
    if (!password) { setError('Please enter a new password'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError("Passwords don't match"); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { setError(error.message); return }

    setSuccess(true)
    setTimeout(() => router.push('/'), 3000)
  }

  return (
    <>
      <Head><title>Reset Password — Adarshini Organic Farm</title></Head>

      <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex',
        alignItems:'center', justifyContent:'center', padding:20,
        fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ background:'var(--card)', borderRadius:20, padding:'36px 32px',
          width:'100%', maxWidth:400, boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
          border:'1px solid var(--border)' }}>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
            <span style={{ fontSize:28 }}>🌿</span>
            <div>
              <div style={{ ...serif, fontSize:18, fontWeight:700, color:'var(--green)', lineHeight:1.1 }}>Adarshini</div>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:2, textTransform:'uppercase' }}>Organic Farm</div>
            </div>
          </div>

          {checking ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:'var(--muted)' }}>
              <div style={{ fontSize:28, marginBottom:10 }}>🔑</div>
              <div style={{ fontSize:14 }}>Verifying reset link…</div>
            </div>

          ) : success ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:44, marginBottom:14 }}>✅</div>
              <div style={{ ...serif, fontSize:22, fontWeight:700, color:'var(--green)', marginBottom:8 }}>
                Password Updated!
              </div>
              <div style={{ fontSize:14, color:'var(--muted)', lineHeight:1.6 }}>
                Your password has been changed successfully.<br />
                Redirecting to the shop…
              </div>
            </div>

          ) : !validSession ? (
            <div style={{ textAlign:'center', padding:'10px 0' }}>
              <div style={{ fontSize:44, marginBottom:14 }}>⚠️</div>
              <div style={{ ...serif, fontSize:20, fontWeight:700, color:'var(--text)', marginBottom:8 }}>
                Link expired or invalid
              </div>
              <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.6, marginBottom:20 }}>
                This password reset link has expired or already been used. Please request a new one.
              </div>
              <button className="btn-g" style={{ width:'100%', padding:12 }}
                onClick={() => router.push('/')}>
                Back to Shop
              </button>
            </div>

          ) : (
            <>
              <div style={{ ...serif, fontSize:24, fontWeight:700, color:'var(--green)', marginBottom:6 }}>
                Set new password
              </div>
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:22 }}>
                Choose a strong password for your account.
              </div>

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>New Password</div>
                <input className="inp" type="password" value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="At least 6 characters" />
              </div>

              <div style={{ marginBottom:20 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Confirm Password</div>
                <input className="inp" type="password" value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError('') }}
                  placeholder="Re-enter your password"
                  onKeyDown={e => e.key === 'Enter' && handleReset()} />
              </div>

              {/* Password strength hint */}
              {password.length > 0 && (
                <div style={{ marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
                  {[1,2,3,4].map(i => (
                    <div key={i} style={{ flex:1, height:4, borderRadius:2,
                      background: password.length >= i * 2
                        ? password.length >= 8 ? 'var(--green)' : 'var(--gold)'
                        : 'var(--border)',
                      transition:'background .2s' }} />
                  ))}
                  <span style={{ fontSize:11, color:'var(--muted)', flexShrink:0 }}>
                    {password.length < 6 ? 'Too short' : password.length < 8 ? 'Fair' : 'Strong'}
                  </span>
                </div>
              )}

              {error && (
                <div style={{ fontSize:13, color:'var(--red)', marginBottom:14,
                  padding:'9px 12px', background:'var(--red-pale)', borderRadius:9 }}>
                  {error}
                </div>
              )}

              <button className="btn-g" style={{ width:'100%', padding:13, fontSize:15 }}
                onClick={handleReset} disabled={loading}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
