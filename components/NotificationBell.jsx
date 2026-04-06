import { supabase } from '../lib/supabase'

export default function NotificationBell({ notifs, setNotifs, user, show, onToggle }) {
  const unread = notifs.filter(n => !n.read).length

  async function markAllRead() {
    if (unread === 0) return
    const ids = notifs.filter(n => !n.read).map(n => n.id)
    await supabase.from('notifications').update({ read: true }).in('id', ids)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  function handleToggle() {
    onToggle()
    if (!show) markAllRead()
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={handleToggle}
        style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 9,
          padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center',
          position: 'relative', color: 'var(--muted)' }}>
        <span style={{ fontSize: 17 }}>🔔</span>
        {unread > 0 && <span className="notif-dot">{unread}</span>}
      </button>

      {show && (
        <>
          <div onClick={onToggle} style={{ position: 'fixed', inset: 0, zIndex: 299 }} />
          <div style={{ position: 'absolute', right: 0, top: 46, zIndex: 300,
            background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 14, width: 310, maxHeight: 400, overflowY: 'auto',
            boxShadow: '0 10px 36px rgba(0,0,0,.14)' }}>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Notifications</span>
              <button onClick={onToggle}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--muted)' }}>
                ✕
              </button>
            </div>

            {notifs.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🌱</div>
                No notifications yet — you'll hear from us when new produce is added!
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : 'var(--green-pale)',
                  transition: 'background .2s' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 15 }}>{n.type === 'new' ? '🌱' : '✏️'}</span>
                    <div>
                      <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.45 }}>{n.message}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
