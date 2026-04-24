import { useState, useEffect } from 'react'
import { useRouter }           from 'next/router'
import Head                    from 'next/head'
import { supabase }            from '../lib/supabase'
import Header                  from '../components/Header'
import { Footer, FloatingWhatsApp } from '../components/Footer'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [notifs, setNotifs]   = useState([])
  const [form, setForm]       = useState({ name:'', phone:'' })
  const [pwForm, setPwForm]   = useState({ current:'', newPw:'', confirm:'' })
  const [loading, setSaving]  = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [toast, setToast]     = useState({ msg:'', type:'success' })
  const [tab, setTab]         = useState('profile')   // profile | password

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!session?.user) { router.replace('/'); return }
      setUser(session.user)
      loadProfile(session.user.id)
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) router.replace('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles')
      .select('name, phone, email').eq('id', userId).single()
    if (data) setForm({ name: data.name || '', phone: data.phone || '' })
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg:'', type:'success' }), 3500)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }
  function setPw(k, v) { setPwForm(f => ({ ...f, [k]: v })) }

  async function saveProfile() {
    if (!form.name.trim()) { showToast('Name cannot be empty', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ name: form.name.trim(), phone: form.phone.trim() })
      .eq('id', user.id)
    setSaving(false)
    if (error) { showToast('Failed to save: ' + error.message, 'error'); return }
    showToast('Profile updated successfully! ✅')
  }

  async function changePassword() {
    if (!pwForm.newPw) { showToast('Please enter a new password', 'error'); return }
    if (pwForm.newPw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return }
    if (pwForm.newPw !== pwForm.confirm) { showToast("Passwords don't match", 'error'); return }
    setPwLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    setPwLoading(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    setPwForm({ current:'', newPw:'', confirm:'' })
    showToast('Password changed successfully! ✅')
  }

  // Password strength
  const strength = pwForm.newPw.length === 0 ? 0
    : pwForm.newPw.length < 6 ? 1
    : pwForm.newPw.length < 8 ? 2
    : /[A-Z]/.test(pwForm.newPw) && /[0-9]/.test(pwForm.newPw) ? 4 : 3
  const strengthLabel = ['', 'Too short', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', 'var(--red)', 'var(--gold)', 'var(--green-l)', 'var(--green)']

  if (!user) return null

  return (
    <>
      <Head><title>My Profile — Adarshini Organic Farm</title></Head>
      <Header user={user} cartCount={0} onCartOpen={() => {}} onAuthOpen={() => {}}
        notifs={notifs} setNotifs={setNotifs} />

      <main style={{ maxWidth:600, margin:'0 auto', padding:'36px 20px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:32 }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--green-pale)',
            display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--green)', fontWeight:700, fontSize:26, flexShrink:0 }}>
            {(user.user_metadata?.name || user.email || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ ...serif, fontSize:26, fontWeight:700, color:'var(--green)' }}>
              {form.name || 'My Profile'}
            </div>
            <div style={{ fontSize:13, color:'var(--muted)', marginTop:2 }}>{user.email}</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:28 }}>
          {[
            { id:'profile',  label:'👤 Edit Profile' },
            { id:'password', label:'🔒 Change Password' },
          ].map(t => (
            <button key={t.id}
              className={`tab-btn ${tab===t.id?'active':''}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── PROFILE TAB ── */}
        {tab === 'profile' && (
          <div className="card" style={{ padding:28 }}>
            <div style={{ fontWeight:700, fontSize:16, color:'var(--green)', marginBottom:22 }}>
              Personal Information
            </div>

            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>Full Name *</div>
              <input className="inp" value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Your full name" />
            </div>

            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>Email Address</div>
              <input className="inp" value={user.email} disabled
                style={{ background:'var(--bg)', color:'var(--muted)', cursor:'not-allowed' }} />
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>
                Email cannot be changed. Contact us if you need to update it.
              </div>
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>Phone Number</div>
              <input className="inp" type="tel" value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="+91 98765 43210" />
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>
                Used for order delivery coordination.
              </div>
            </div>

            <button className="btn-g" style={{ width:'100%', padding:13, fontSize:15 }}
              onClick={saveProfile} disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* ── PASSWORD TAB ── */}
        {tab === 'password' && (
          <div className="card" style={{ padding:28 }}>
            <div style={{ fontWeight:700, fontSize:16, color:'var(--green)', marginBottom:22 }}>
              Change Password
            </div>

            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>New Password</div>
              <input className="inp" type="password" value={pwForm.newPw}
                onChange={e => setPw('newPw', e.target.value)}
                placeholder="At least 6 characters" />
              {/* Strength bar */}
              {pwForm.newPw.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex:1, height:4, borderRadius:2,
                        background: strength >= i ? strengthColor[strength] : 'var(--border)',
                        transition:'background .2s' }} />
                    ))}
                  </div>
                  <div style={{ fontSize:11, color: strengthColor[strength] }}>
                    {strengthLabel[strength]}
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>Confirm New Password</div>
              <input className="inp" type="password" value={pwForm.confirm}
                onChange={e => setPw('confirm', e.target.value)}
                placeholder="Re-enter new password"
                onKeyDown={e => e.key==='Enter' && changePassword()} />
              {/* Match indicator */}
              {pwForm.confirm.length > 0 && (
                <div style={{ fontSize:11, marginTop:5,
                  color: pwForm.newPw === pwForm.confirm ? 'var(--green)' : 'var(--red)' }}>
                  {pwForm.newPw === pwForm.confirm ? '✓ Passwords match' : '✗ Passwords do not match'}
                </div>
              )}
            </div>

            <button className="btn-g" style={{ width:'100%', padding:13, fontSize:15 }}
              onClick={changePassword} disabled={pwLoading}>
              {pwLoading ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        )}

        {/* Back to shop */}
        <div style={{ textAlign:'center', marginTop:20 }}>
          <button onClick={() => router.push('/')}
            style={{ background:'none', border:'none', cursor:'pointer',
              color:'var(--muted)', fontSize:13, textDecoration:'underline',
              fontFamily:'DM Sans, sans-serif' }}>
            ← Back to Shop
          </button>
        </div>
      </main>

      <Footer />
      <FloatingWhatsApp />

      {/* Toast */}
      {toast.msg && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background: toast.type==='error' ? 'var(--red)' : 'var(--text)',
          color:'#fff', padding:'11px 22px', borderRadius:12, fontSize:13, zIndex:999,
          whiteSpace:'nowrap', boxShadow:'0 6px 20px rgba(0,0,0,.22)', fontWeight:500 }}>
          {toast.msg}
        </div>
      )}
    </>
  )
}
