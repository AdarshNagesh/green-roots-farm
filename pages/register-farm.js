import { useState, useEffect } from 'react'
import { useRouter }           from 'next/router'
import Head                    from 'next/head'
import { supabase }            from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function RegisterFarm() {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone]       = useState(false)
  const [error, setError]     = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ email:'', password:'', name:'' })
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [form, setForm] = useState({
    name:'', owner_name:'', email:'', phone:'', upi_id:'', description:'', city:'Mysore'
  })

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (session?.user) {
        setUser(session.user)
        setForm(f => ({
          ...f,
          owner_name: session.user.user_metadata?.name || '',
          email: session.user.email,
        }))
      }
    })
    supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setUser(session.user)
        setForm(f => ({
          ...f,
          owner_name: session.user.user_metadata?.name || f.owner_name,
          email: session.user.email,
        }))
      }
    })
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function handleAuth() {
    setAuthLoading(true); setAuthError('')
    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({
          email: authForm.email, password: authForm.password,
          options: { data: { name: authForm.name } }
        })
        if (error) throw error
        setAuthError('Check your email to confirm your account, then login.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authForm.email, password: authForm.password
        })
        if (error) throw error
        setShowAuth(false)
      }
    } catch (e) { setAuthError(e.message) }
    finally { setAuthLoading(false) }
  }

  async function submit() {
    if (!user) { setShowAuth(true); return }
    if (!form.name.trim()) { setError('Farm name is required'); return }
    if (!form.owner_name.trim()) { setError('Owner name is required'); return }
    if (!form.email.trim()) { setError('Email is required'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/farms/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, owner_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setDone(true)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (done) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center',
      justifyContent:'center', fontFamily:'DM Sans, sans-serif', padding:20 }}>
      <div style={{ maxWidth:480, textAlign:'center' }}>
        <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
        <div style={{ ...serif, fontSize:26, fontWeight:700, color:'var(--green)', marginBottom:10 }}>
          Application Submitted!
        </div>
        <div style={{ fontSize:14, color:'var(--muted)', lineHeight:1.8, marginBottom:24 }}>
          Your farm registration is under review. You'll receive an email once approved — usually within 24 hours.
        </div>
        <button className="btn-g" style={{ padding:'11px 28px' }} onClick={() => router.push('/')}>
          Back to Shop
        </button>
      </div>
    </div>
  )

  return (
    <>
      <Head><title>Register Your Farm — Adarshini Organic</title></Head>
      <div style={{ minHeight:'100vh', background:'var(--bg)', fontFamily:'DM Sans, sans-serif' }}>

        {/* Header */}
        <div style={{ background:'var(--card)', borderBottom:'1px solid var(--border)',
          padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:26 }}>🌿</span>
            <div style={{ ...serif, fontSize:18, fontWeight:700, color:'var(--green)' }}>Adarshini Organic Farm</div>
          </div>
          {user
            ? <span style={{ fontSize:13, color:'var(--muted)' }}>{user.email}</span>
            : <button className="btn-o" style={{ padding:'7px 16px', fontSize:13 }}
                onClick={() => setShowAuth(true)}>Login / Register</button>
          }
        </div>

        <main style={{ maxWidth:580, margin:'0 auto', padding:'40px 20px' }}>
          <div style={{ marginBottom:28 }}>
            <div style={{ ...serif, fontSize:28, fontWeight:700, color:'var(--green)', marginBottom:6 }}>
              Register Your Farm 🚜
            </div>
            <div style={{ fontSize:14, color:'var(--muted)', lineHeight:1.6 }}>
              Join our platform and sell your produce directly to customers in Mysore.
              Our team will review and approve your registration within 24 hours.
            </div>
          </div>

          {!user && (
            <div style={{ marginBottom:20, padding:'14px 18px', background:'var(--gold-pale)',
              border:'1.5px solid var(--gold)', borderRadius:12, fontSize:13, color:'var(--gold)' }}>
              ⚠️ Please <button onClick={() => setShowAuth(true)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green)',
                  fontWeight:700, fontSize:13, padding:0 }}>login or create an account</button> first to register your farm.
            </div>
          )}

          <div className="card" style={{ padding:28 }}>
            {[
              { label:'Farm Name *',       key:'name',        placeholder:'e.g. Green Valley Farm' },
              { label:'Owner Name *',      key:'owner_name',  placeholder:'Your full name' },
              { label:'Contact Email *',   key:'email',       placeholder:'farm@example.com' },
              { label:'WhatsApp / Phone',  key:'phone',       placeholder:'+91 98765 43210' },
              { label:'UPI ID',            key:'upi_id',      placeholder:'yourname@upi (for receiving payments)' },
              { label:'City / Area',       key:'city',        placeholder:'e.g. Mysore, Mandya' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:5 }}>{f.label}</div>
                <input className="inp" value={form[f.key]}
                  onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
              </div>
            ))}

            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:5 }}>
                About Your Farm
              </div>
              <textarea className="inp" rows={3} value={form.description}
                onChange={e => set('description', e.target.value)}
                placeholder="Tell customers about your farm, growing methods, specialties…" />
            </div>

            <div style={{ padding:'12px 14px', background:'var(--green-pale)', borderRadius:10,
              fontSize:12, color:'var(--muted)', lineHeight:1.7, marginBottom:18 }}>
              💡 After approval you can log in and manage your products and orders from the Farm Portal.
              Platform fee (if any) is set by the admin and shown transparently in reports.
            </div>

            {error && (
              <div style={{ fontSize:13, color:'var(--red)', padding:'10px 13px',
                background:'var(--red-pale)', borderRadius:9, marginBottom:14 }}>
                {error}
              </div>
            )}

            <button className="btn-g" style={{ width:'100%', padding:13, fontSize:15 }}
              onClick={submit} disabled={loading}>
              {loading ? 'Submitting…' : user ? 'Submit for Approval' : 'Login to Submit'}
            </button>
          </div>
        </main>
      </div>

      {/* Auth Modal */}
      {showAuth && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setShowAuth(false)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ ...serif, fontSize:20, fontWeight:700 }}>
                {authMode === 'login' ? 'Login' : 'Create Account'}
              </div>
              <button onClick={() => setShowAuth(false)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--muted)' }}>✕</button>
            </div>

            {authMode === 'register' && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Your Name</div>
                <input className="inp" value={authForm.name} placeholder="Full name"
                  onChange={e => setAuthForm(f => ({ ...f, name: e.target.value }))} />
              </div>
            )}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Email</div>
              <input className="inp" type="email" value={authForm.email} placeholder="you@email.com"
                onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Password</div>
              <input className="inp" type="password" value={authForm.password} placeholder="Password"
                onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))} />
            </div>

            {authError && (
              <div style={{ fontSize:13, padding:'9px 12px', borderRadius:9, marginBottom:14,
                background: authError.includes('Check') ? 'var(--green-pale)' : 'var(--red-pale)',
                color: authError.includes('Check') ? 'var(--green)' : 'var(--red)' }}>
                {authError}
              </div>
            )}

            <button className="btn-g" style={{ width:'100%', padding:11 }}
              onClick={handleAuth} disabled={authLoading}>
              {authLoading ? '…' : authMode === 'login' ? 'Login' : 'Create Account'}
            </button>
            <div style={{ textAlign:'center', marginTop:14, fontSize:13, color:'var(--muted)' }}>
              {authMode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError('') }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green)', fontWeight:600, fontSize:13 }}>
                {authMode === 'login' ? 'Create one' : 'Login'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
