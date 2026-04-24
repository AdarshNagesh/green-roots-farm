import { useState }    from 'react'
import { useRouter }   from 'next/router'
import { supabase, isAdmin } from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function Header({ user, cartCount, onCartOpen, onAuthOpen, notifs = [], setNotifs }) {
  const router  = useRouter()
  const admin   = isAdmin(user)
  const unread  = notifs.filter(n => !n.read).length
  const [showNotif, setShowNotif] = useState(false)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  async function toggleNotif() {
    setShowNotif(v => !v)
    if (!showNotif && unread > 0 && user) {
      const ids = notifs.filter(n => !n.read).map(n => n.id)
      await supabase.from('notifications').update({ read: true }).in('id', ids)
      setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    }
  }

  return (
    <header style={{
      background: 'var(--card)', borderBottom: '1px solid var(--border)',
      padding: '0 20px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 200,
      boxShadow: '0 2px 12px var(--shadow)',
    }}>
      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        onClick={() => router.push('/')}>
        <span style={{ fontSize:30 }}>🌿</span>
        <div>
          <div style={{ ...serif, fontSize:18, fontWeight:700, color:'var(--green)', lineHeight:1.1 }}>Adarshini</div>
          <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:2, textTransform:'uppercase' }}>Organic Farm</div>
        </div>
      </div>

      {/* Right nav */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>

        {admin && <>
          <button className="btn-o" style={{ padding:'6px 13px', fontSize:13 }} onClick={() => router.push('/')}>Shop</button>
          <button className={router.pathname==='/admin' ? 'btn-g' : 'btn-o'}
            style={{ padding:'6px 13px', fontSize:13 }} onClick={() => router.push('/admin')}>Admin Panel</button>
        </>}

        {user && !admin && <>
          <button className={router.pathname==='/orders' ? 'btn-g' : 'btn-o'}
            style={{ padding:'6px 13px', fontSize:13 }} onClick={() => router.push('/orders')}>
            📦 My Orders
          </button>

          {/* Bell */}
          <div style={{ position:'relative' }}>
            <button onClick={toggleNotif}
              style={{ background:'none', border:'1.5px solid var(--border)', borderRadius:9,
                padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center',
                position:'relative', color:'var(--muted)' }}>
              <span style={{ fontSize:17 }}>🔔</span>
              {unread > 0 && (
                <span style={{ position:'absolute', top:-4, right:-4, background:'var(--gold)',
                  color:'#fff', borderRadius:9, fontSize:10, padding:'1px 5px', fontWeight:700, lineHeight:1.4 }}>
                  {unread}
                </span>
              )}
            </button>

            {showNotif && <>
              <div onClick={() => setShowNotif(false)} style={{ position:'fixed', inset:0, zIndex:299 }} />
              <div style={{ position:'absolute', right:0, top:46, zIndex:300,
                background:'var(--card)', border:'1px solid var(--border)',
                borderRadius:14, width:310, maxHeight:400, overflowY:'auto',
                boxShadow:'0 10px 36px rgba(0,0,0,.14)' }}>
                <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)',
                  display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:600, fontSize:14 }}>Notifications</span>
                  <button onClick={() => setShowNotif(false)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:16, color:'var(--muted)' }}>✕</button>
                </div>
                {notifs.length === 0
                  ? <div style={{ padding:'28px 20px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
                      <div style={{ fontSize:28, marginBottom:8 }}>🌱</div>No notifications yet!
                    </div>
                  : notifs.map(n => (
                    <div key={n.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)',
                      background: n.read ? 'transparent' : 'var(--green-pale)', transition:'background .2s' }}>
                      <div style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                        <span style={{ fontSize:15 }}>
                          {n.type==='new' ? '🌱' : n.type==='order' ? '📦' : '✏️'}
                        </span>
                        <div>
                          <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.45 }}>{n.message}</div>
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
                            {new Date(n.created_at).toLocaleString('en-IN')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </>}
          </div>

          {/* Cart */}
          <button onClick={onCartOpen}
            style={{ background:'none', border:'1.5px solid var(--border)', borderRadius:9,
              padding:'6px 13px', cursor:'pointer', display:'flex', alignItems:'center',
              gap:6, color:'var(--text)', fontSize:14 }}>
            🛒
            {cartCount > 0 && (
              <span style={{ background:'var(--green)', color:'#fff', borderRadius:9,
                fontSize:11, padding:'0 6px', fontWeight:700 }}>{cartCount}</span>
            )}
          </button>
        </>}

        {!user && (
          <button onClick={onCartOpen}
            style={{ background:'none', border:'1.5px solid var(--border)', borderRadius:9,
              padding:'6px 13px', cursor:'pointer', display:'flex', alignItems:'center',
              gap:6, color:'var(--text)', fontSize:14 }}>
            🛒
            {cartCount > 0 && <span style={{ background:'var(--green)', color:'#fff',
              borderRadius:9, fontSize:11, padding:'0 6px', fontWeight:700 }}>{cartCount}</span>}
          </button>
        )}

        {user ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
           <div onClick={() => router.push('/profile')}
  style={{ width:32, height:32, borderRadius:'50%', background:'var(--green-pale)',
    display:'flex', alignItems:'center', justifyContent:'center',
    color:'var(--green)', fontWeight:700, fontSize:13, cursor:'pointer' }}
  title="Edit Profile">
  {(user.user_metadata?.name || user.email || 'U').charAt(0).toUpperCase()}
</div>
            <span style={{ fontSize:13, color:'var(--muted)', maxWidth:90,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {(user.user_metadata?.name || user.email).split(' ')[0]}
            </span>
            <button className="btn-o" style={{ padding:'5px 12px', fontSize:12 }} onClick={logout}>Logout</button>
          </div>
        ) : (
          <button className="btn-g" style={{ padding:'7px 16px', fontSize:13 }} onClick={onAuthOpen}>Sign In</button>
        )}
      </div>
    </header>
  )
}
