import { useState } from 'react'
import { useRouter } from 'next/router'
import { supabase, isAdmin } from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function Header({ user, cartCount, onCartOpen, onAuthOpen, notifCount, onNotifOpen }) {
  const router = useRouter()
  const admin  = isAdmin(user)

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <header style={{
      background: 'var(--card)', borderBottom: '1px solid var(--border)',
      padding: '0 20px', height: 64, display: 'flex',
      alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 200,
      boxShadow: '0 2px 12px var(--shadow)',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
        onClick={() => router.push('/')}>
        <span style={{ fontSize: 30 }}>🌿</span>
        <div>
          <div style={{ ...serif, fontSize: 18, fontWeight: 700, color: 'var(--green)', lineHeight: 1.1 }}>
            Green Roots
          </div>
          <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: 2, textTransform: 'uppercase' }}>
            Organic Farm
          </div>
        </div>
      </div>

      {/* Right nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {admin && (
          <>
            <button className="btn-o" style={{ padding: '6px 13px', fontSize: 13 }}
              onClick={() => router.push('/')}>Shop View</button>
            <button className={router.pathname === '/admin' ? 'btn-g' : 'btn-o'}
              style={{ padding: '6px 13px', fontSize: 13 }}
              onClick={() => router.push('/admin')}>Admin Panel</button>
          </>
        )}

        {/* Notification bell — customers only */}
        {user && !admin && (
          <button onClick={onNotifOpen}
            style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 9,
              padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
              position: 'relative', color: 'var(--muted)' }}>
            <span style={{ fontSize: 17 }}>🔔</span>
            {notifCount > 0 && <span className="notif-dot">{notifCount}</span>}
          </button>
        )}

        {/* Cart — non-admin only */}
        {!admin && (
          <button onClick={onCartOpen}
            style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 9,
              padding: '6px 13px', cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: 6, color: 'var(--text)', fontSize: 14, position: 'relative' }}>
            🛒
            {cartCount > 0 && (
              <span style={{ background: 'var(--green)', color: '#fff', borderRadius: 9,
                fontSize: 11, padding: '0 6px', fontWeight: 700 }}>{cartCount}</span>
            )}
          </button>
        )}

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--green-pale)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--green)', fontWeight: 700, fontSize: 13 }}>
              {(user.user_metadata?.name || user.email || 'U').charAt(0).toUpperCase()}
            </div>
            <button className="btn-o" style={{ padding: '5px 12px', fontSize: 12 }}
              onClick={logout}>Logout</button>
          </div>
        ) : (
          <button className="btn-g" style={{ padding: '7px 16px', fontSize: 13 }}
            onClick={onAuthOpen}>Sign In</button>
        )}
      </div>
    </header>
  )
}
