import { useState } from 'react'
import { supabase } from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode]       = useState('login')   // login | register | forgot
  const [form, setForm]       = useState({ name:'', email:'', password:'' })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); setError(''); setSuccess('') }
  function switchMode(m) { setMode(m); setError(''); setSuccess(''); setForm({ name:'', email:'', password:'' }) }

  async function submit() {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
        if (error) throw error
        onSuccess?.(); onClose()

      } else if (mode === 'register') {
        if (!form.name || !form.email || !form.password) throw new Error('All fields are required')
        if (form.password.length < 6) throw new Error('Password must be at least 6 characters')
        const { error } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { name: form.name } },
        })
        if (error) throw error
        onSuccess?.(); onClose()

      } else if (mode === 'forgot') {
        if (!form.email) throw new Error('Please enter your email address')
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `https://green-roots-farm.vercel.app/reset-password`,
        })
        if (error) throw error
        setSuccess('Password reset link sent! Check your email inbox.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const titles = { login:'Welcome back 👋', register:'Join our farm 🌿', forgot:'Reset password 🔑' }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div style={{ ...serif, fontSize:24, fontWeight:700, color:'var(--green)' }}>{titles[mode]}</div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--muted)' }}>✕</button>
        </div>

        {mode === 'forgot' && !success && (
          <div style={{ fontSize:13, color:'var(--muted)', marginBottom:16, lineHeight:1.6,
            padding:'10px 12px', background:'var(--green-pale)', borderRadius:9 }}>
            Enter your registered email and we'll send you a link to reset your password.
          </div>
        )}

        {!success && <>
          {mode === 'register' && (
            <Field label="Full Name">
              <input className="inp" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
            </Field>
          )}

          <Field label="Email Address">
            <input className="inp" type="email" value={form.email}
              onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
          </Field>

          {mode !== 'forgot' && (
            <Field label="Password">
              <input className="inp" type="password" value={form.password}
                onChange={e => set('password', e.target.value)} placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()} />
            </Field>
          )}
        </>}

        {/* Forgot password link */}
        {mode === 'login' && (
          <div style={{ textAlign:'right', marginTop:-6, marginBottom:14 }}>
            <button onClick={() => switchMode('forgot')}
              style={{ background:'none', border:'none', cursor:'pointer',
                color:'var(--muted)', fontSize:12, textDecoration:'underline',
                fontFamily:'DM Sans, sans-serif' }}>
              Forgot password?
            </button>
          </div>
        )}

        {error && (
          <div style={{ fontSize:13, color:'var(--red)', marginBottom:14,
            padding:'9px 12px', background:'var(--red-pale)', borderRadius:9 }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ fontSize:13, marginBottom:20,
            padding:'14px 16px', background:'var(--green-pale)', borderRadius:9, lineHeight:1.6,
            display:'flex', gap:10, alignItems:'flex-start' }}>
            <span style={{ fontSize:22, flexShrink:0 }}>✅</span>
            <div>
              <div style={{ fontWeight:600, marginBottom:4, color:'var(--green)' }}>Email sent!</div>
              <div style={{ color:'var(--text)', fontSize:13 }}>{success}</div>
              <div style={{ marginTop:6, fontSize:12, color:'var(--muted)' }}>
                Check your spam/junk folder if you don't see it within a minute.
              </div>
            </div>
          </div>
        )}

        {!success && (
          <button className="btn-g" style={{ width:'100%', padding:12, fontSize:15, marginBottom:16 }}
            onClick={submit} disabled={loading}>
            {loading ? 'Please wait…'
              : mode === 'login' ? 'Sign In'
              : mode === 'register' ? 'Create Account'
              : 'Send Reset Link'}
          </button>
        )}

        {/* Footer links */}
        <div style={{ textAlign:'center', fontSize:13, color:'var(--muted)', display:'flex', flexDirection:'column', gap:8 }}>
          {mode === 'login' && (
            <span>Don't have an account? <Lnk onClick={() => switchMode('register')}>Register free</Lnk></span>
          )}
          {mode === 'register' && (
            <span>Already have an account? <Lnk onClick={() => switchMode('login')}>Sign In</Lnk></span>
          )}
          {mode === 'forgot' && (
            <span>Remember it? <Lnk onClick={() => switchMode('login')}>Back to Sign In</Lnk></span>
          )}
        </div>

        {mode === 'register' && (
          <div style={{ marginTop:12, fontSize:12, color:'var(--muted)', padding:'9px 12px',
            background:'var(--green-pale)', borderRadius:9 }}>
            🔔 You'll get notifications whenever new produce is added or prices change!
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>{label}</div>
      {children}
    </div>
  )
}

function Lnk({ onClick, children }) {
  return (
    <button onClick={onClick}
      style={{ background:'none', border:'none', cursor:'pointer',
        color:'var(--green)', fontWeight:600, fontSize:13, fontFamily:'DM Sans, sans-serif' }}>
      {children}
    </button>
  )
}
