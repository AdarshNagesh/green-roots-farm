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
  const [pwForm, setPwForm]   = useState({ newPw:'', confirm:'' })
  const [loading, setSaving]  = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [toast, setToast]     = useState({ msg:'', type:'success' })
  const [tab, setTab]         = useState('profile')

  // Loyalty state
  const [pointsBalance, setPointsBalance]   = useState(0)
  const [referralCode, setReferralCode]     = useState('')
  const [transactions, setTransactions]     = useState([])
  const [referralInput, setReferralInput]   = useState('')
  const [referralSaving, setReferralSaving] = useState(false)
  const [referredBy, setReferredBy]         = useState(null)
  const [copied, setCopied]                 = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!session?.user) { router.replace('/'); return }
      setUser(session.user)
      loadProfile(session.user.id)
      loadCredits(session.user.id)
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

  async function loadCredits(userId) {
    const res = await fetch(`/api/credits/balance?user_id=${userId}`)
    if (!res.ok) return
    const d = await res.json()
    setPointsBalance(d.points_balance || 0)
    setReferralCode(d.referral_code || '')
    setReferredBy(d.referred_by || null)
    setTransactions(d.transactions || [])
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
    setPwForm({ newPw:'', confirm:'' })
    showToast('Password changed successfully! ✅')
  }

  async function saveReferralCode() {
    if (!referralInput.trim()) return
    if (referralInput.trim().toUpperCase() === referralCode) {
      showToast("You can't use your own referral code!", 'error'); return
    }
    setReferralSaving(true)
    // Verify code exists
    const { data } = await supabase.from('profiles')
      .select('id').eq('referral_code', referralInput.trim().toUpperCase()).single()
    if (!data) { showToast('Invalid referral code — please check and try again', 'error'); setReferralSaving(false); return }
    const { error } = await supabase.from('profiles')
      .update({ referred_by: referralInput.trim().toUpperCase() }).eq('id', user.id)
    setReferralSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    setReferredBy(referralInput.trim().toUpperCase())
    setReferralInput('')
    showToast('Referral code applied! Your friend will earn 20 points when you place your first order ✅')
  }

  function copyReferralCode() {
    const link = `${window.location.origin}?ref=${referralCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    })
  }

  const strength = pwForm.newPw.length === 0 ? 0
    : pwForm.newPw.length < 6 ? 1
    : pwForm.newPw.length < 8 ? 2
    : /[A-Z]/.test(pwForm.newPw) && /[0-9]/.test(pwForm.newPw) ? 4 : 3
  const strengthLabel = ['', 'Too short', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', 'var(--red)', 'var(--gold)', 'var(--green-l)', 'var(--green)']

  if (!user) return null

  function txIcon(type) {
    if (type === 'purchase')   return '🛒'
    if (type === 'referral')   return '🎁'
    if (type === 'redemption') return '💰'
    return '⭐'
  }

  return (
    <>
      <Head><title>My Profile — Adarshini Organic Farm</title></Head>
      <Header user={user} cartCount={0} onCartOpen={() => {}} onAuthOpen={() => {}}
        notifs={notifs} setNotifs={setNotifs} />

      <main style={{ maxWidth:640, margin:'0 auto', padding:'36px 20px' }}>

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

        {/* Points banner */}
        <div style={{ background:'linear-gradient(130deg, var(--green) 0%, var(--green-l) 100%)',
          borderRadius:16, padding:'18px 22px', marginBottom:24, color:'#fff',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:11, opacity:0.8, textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>
              Your Points Balance
            </div>
            <div style={{ ...serif, fontSize:36, fontWeight:700 }}>{pointsBalance}</div>
            <div style={{ fontSize:12, opacity:0.8, marginTop:2 }}>
              Worth ₹{pointsBalance} — redeem at checkout
            </div>
          </div>
          <div style={{ fontSize:52, opacity:0.3 }}>⭐</div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:28, overflowX:'auto' }}>
          {[
            { id:'profile',  label:'👤 Profile'  },
            { id:'password', label:'🔒 Password'  },
            { id:'loyalty',  label:'⭐ Points'    },
            { id:'referral', label:'🎁 Referral'  },
          ].map(t => (
            <button key={t.id} className={`tab-btn ${tab===t.id?'active':''}`} onClick={() => setTab(t.id)}>
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
              <input className="inp" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Your full name" />
            </div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>Email Address</div>
              <input className="inp" value={user.email} disabled
                style={{ background:'var(--bg)', color:'var(--muted)', cursor:'not-allowed' }} />
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:5 }}>
                Email cannot be changed. Contact us if needed.
              </div>
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>Phone Number</div>
              <input className="inp" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
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
            <div style={{ fontWeight:700, fontSize:16, color:'var(--green)', marginBottom:22 }}>Change Password</div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>New Password</div>
              <input className="inp" type="password" value={pwForm.newPw}
                onChange={e => setPw('newPw', e.target.value)} placeholder="At least 6 characters" />
              {pwForm.newPw.length > 0 && (
                <div style={{ marginTop:8 }}>
                  <div style={{ display:'flex', gap:4, marginBottom:4 }}>
                    {[1,2,3,4].map(i => (
                      <div key={i} style={{ flex:1, height:4, borderRadius:2,
                        background: strength >= i ? strengthColor[strength] : 'var(--border)', transition:'background .2s' }} />
                    ))}
                  </div>
                  <div style={{ fontSize:11, color: strengthColor[strength] }}>{strengthLabel[strength]}</div>
                </div>
              )}
            </div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:600, marginBottom:6,
                textTransform:'uppercase', letterSpacing:0.5 }}>Confirm New Password</div>
              <input className="inp" type="password" value={pwForm.confirm}
                onChange={e => setPw('confirm', e.target.value)} placeholder="Re-enter new password"
                onKeyDown={e => e.key==='Enter' && changePassword()} />
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

        {/* ── LOYALTY TAB ── */}
        {tab === 'loyalty' && (
          <div>
            <div className="card" style={{ padding:22, marginBottom:16 }}>
              <div style={{ fontWeight:700, fontSize:16, color:'var(--green)', marginBottom:4 }}>⭐ How Points Work</div>
              <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.8 }}>
                • Earn points on every purchase — set per product by the farm<br/>
                • Refer friends and earn <strong>20 points</strong> when they place their first order<br/>
                • Redeem points at checkout — <strong>1 point = ₹1 discount</strong><br/>
                • Points never expire
              </div>
            </div>

            <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>Transaction History</div>
            {transactions.length === 0 ? (
              <div className="card" style={{ padding:32, textAlign:'center', color:'var(--muted)' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>⭐</div>
                <div style={{ fontWeight:600 }}>No transactions yet</div>
                <div style={{ fontSize:13, marginTop:4 }}>Start shopping to earn points!</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {transactions.map(tx => (
                  <div key={tx.id} className="card" style={{ padding:'12px 16px', display:'flex',
                    justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:22 }}>{txIcon(tx.type)}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:500 }}>{tx.description}</div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                          {new Date(tx.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight:700, fontSize:16,
                      color: tx.points > 0 ? 'var(--green)' : 'var(--red)' }}>
                      {tx.points > 0 ? '+' : ''}{tx.points} pts
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REFERRAL TAB ── */}
        {tab === 'referral' && (
          <div>
            {/* Your referral code */}
            <div className="card" style={{ padding:24, marginBottom:16, textAlign:'center' }}>
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:8 }}>Your Referral Code</div>
              <div style={{ ...serif, fontSize:36, fontWeight:700, color:'var(--green)', letterSpacing:4, marginBottom:16 }}>
                {referralCode || '------'}
              </div>
              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:16, lineHeight:1.6 }}>
                Share this code with friends.<br/>
                When they place their first order, you earn <strong>20 points (₹20)</strong>!
              </div>
              <button className="btn-g" style={{ padding:'10px 24px' }} onClick={copyReferralCode}>
                {copied ? '✓ Copied!' : '📋 Copy Referral Link'}
              </button>
            </div>

            {/* WhatsApp share */}
            <div className="card" style={{ padding:16, marginBottom:16 }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:10 }}>Share via WhatsApp</div>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Hey! Shop fresh organic produce at Adarshini Organic Farm 🌿\n\nUse my referral code ${referralCode} when you register to get started!\n\n${typeof window !== 'undefined' ? window.location.origin : 'https://adarshini.co.in'}?ref=${referralCode}`)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display:'flex', alignItems:'center', gap:10, padding:'11px 16px',
                  background:'#25D366', color:'#fff', borderRadius:10, textDecoration:'none',
                  fontWeight:600, fontSize:14 }}>
                <span style={{ fontSize:20 }}>📱</span>
                Share on WhatsApp
              </a>
            </div>

            {/* Enter referral code */}
            {!referredBy ? (
              <div className="card" style={{ padding:22 }}>
                <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>Have a friend's referral code?</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginBottom:14 }}>
                  Enter it below to credit your friend with 20 points when you place your first order.
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <input className="inp" value={referralInput}
                    onChange={e => setReferralInput(e.target.value.toUpperCase())}
                    placeholder="e.g. ABC123" maxLength={6}
                    style={{ flex:1, textTransform:'uppercase', letterSpacing:2, fontWeight:600 }} />
                  <button className="btn-g" style={{ padding:'10px 18px' }}
                    onClick={saveReferralCode} disabled={referralSaving || !referralInput.trim()}>
                    {referralSaving ? '…' : 'Apply'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding:18, background:'var(--green-pale)' }}>
                <div style={{ fontSize:13, color:'var(--green)', fontWeight:600 }}>
                  ✅ You joined using referral code <strong>{referredBy}</strong>
                </div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>
                  Your friend will earn 20 points when you place your first order.
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ textAlign:'center', marginTop:24 }}>
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
