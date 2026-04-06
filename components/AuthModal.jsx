import { useState } from 'react'
import { supabase } from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode]     = useState('login')
  const [form, setForm]     = useState({ name: '', email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); setError('') }

  async function submit() {
    setError(''); setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email, password: form.password,
        })
        if (error) throw error
      } else {
        if (!form.name || !form.email || !form.password) throw new Error('All fields are required')
        if (form.password.length < 6) throw new Error('Password must be at least 6 characters')
        const { error } = await supabase.auth.signUp({
          email: form.email, password: form.password,
          options: { data: { name: form.name } },
        })
        if (error) throw error
      }
      onSuccess?.()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ ...serif, fontSize: 24, fontWeight: 700, color: 'var(--green)' }}>
            {mode === 'login' ? 'Welcome back 👋' : 'Join our farm 🌿'}
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)' }}>
            ✕
          </button>
        </div>

        {mode === 'register' && (
          <Field label="Full Name">
            <input className="inp" value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="Your full name" />
          </Field>
        )}
        <Field label="Email Address">
          <input className="inp" type="email" value={form.email}
            onChange={e => set('email', e.target.value)} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <input className="inp" type="password" value={form.password}
            onChange={e => set('password', e.target.value)} placeholder="••••••••"
            onKeyDown={e => e.key === 'Enter' && submit()} />
        </Field>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red)', marginBottom: 14,
            padding: '9px 12px', background: 'var(--red-pale)', borderRadius: 9 }}>
            {error}
          </div>
        )}

        <button className="btn-g" style={{ width: '100%', padding: 12, fontSize: 15, marginBottom: 16 }}
          onClick={submit} disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        {mode === 'register' && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12,
            padding: '9px 12px', background: 'var(--green-pale)', borderRadius: 9 }}>
            🔔 You'll get notifications whenever new produce is added or prices change!
          </div>
        )}

        <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--green)', fontWeight: 600, fontSize: 13 }}>
            {mode === 'login' ? 'Register free' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  )
}
