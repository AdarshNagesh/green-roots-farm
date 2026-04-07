const serif = { fontFamily: 'Playfair Display, serif' }

const PHONE    = process.env.NEXT_PUBLIC_CONTACT_PHONE    || ''
const EMAIL    = process.env.NEXT_PUBLIC_CONTACT_EMAIL    || ''
const WHATSAPP = process.env.NEXT_PUBLIC_CONTACT_WHATSAPP || PHONE  // defaults to phone if not set separately

// Clean phone for WhatsApp link (digits only, with country code)
function waNumber(num) {
  const digits = num.replace(/\D/g, '')
  return digits.startsWith('91') ? digits : '91' + digits
}

// ── Floating WhatsApp button ──────────────────────────────────────────────────
export function FloatingWhatsApp({ message = "Hi! I have a question about your farm produce." }) {
  if (!PHONE && !WHATSAPP) return null
  const num  = waNumber(WHATSAPP || PHONE)
  const href = `https://wa.me/${num}?text=${encodeURIComponent(message)}`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Chat with us on WhatsApp"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 800,
        width: 56, height: 56, borderRadius: '50%',
        background: '#25D366', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 18px rgba(37,211,102,0.45)',
        textDecoration: 'none', transition: 'transform .2s, box-shadow .2s',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(37,211,102,0.55)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';   e.currentTarget.style.boxShadow = '0 4px 18px rgba(37,211,102,0.45)' }}
    >
      {/* WhatsApp SVG icon */}
      <svg viewBox="0 0 32 32" width="28" height="28" fill="currentColor">
        <path d="M16 .5C7.44.5.5 7.44.5 16c0 2.77.72 5.37 1.98 7.63L.5 31.5l8.1-2.12A15.47 15.47 0 0016 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5zm0 28.4a13.4 13.4 0 01-6.83-1.87l-.49-.29-5.07 1.33 1.35-4.93-.32-.51A13.37 13.37 0 012.6 16C2.6 8.6 8.6 2.6 16 2.6S29.4 8.6 29.4 16 23.4 28.9 16 28.9zm7.34-9.97c-.4-.2-2.38-1.17-2.75-1.3-.37-.14-.63-.2-.9.2-.26.4-1.02 1.3-1.25 1.57-.23.27-.46.3-.86.1-.4-.2-1.68-.62-3.2-1.97-1.18-1.05-1.98-2.35-2.21-2.75-.23-.4-.02-.61.17-.81.18-.18.4-.46.6-.7.2-.23.26-.4.4-.66.13-.27.07-.5-.03-.7-.1-.2-.9-2.17-1.23-2.97-.32-.78-.65-.67-.9-.68h-.76c-.27 0-.7.1-1.06.5-.37.4-1.4 1.37-1.4 3.33 0 1.97 1.43 3.87 1.63 4.13.2.27 2.82 4.3 6.83 6.03.95.41 1.7.66 2.28.84.96.3 1.83.26 2.52.16.77-.12 2.38-.97 2.72-1.91.33-.94.33-1.75.23-1.91-.1-.17-.37-.27-.77-.47z"/>
      </svg>
    </a>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────────
export function Footer() {
  const num  = waNumber(WHATSAPP || PHONE)
  const waHref = `https://wa.me/${num}?text=${encodeURIComponent('Hi! I have a question about your farm produce.')}`

  return (
    <footer style={{
      background: 'var(--text)', color: 'rgba(255,255,255,0.85)',
      marginTop: 64, padding: '48px 20px 32px',
    }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', gap: 40, marginBottom: 40 }}>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 28 }}>🌿</span>
              <div style={{ ...serif, fontSize: 20, fontWeight: 700, color: '#fff' }}>Green Roots Farm</div>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.75, color: 'rgba(255,255,255,0.6)', maxWidth: 260 }}>
              Organically grown produce harvested at peak ripeness — from our soil to your table. No chemicals, no middlemen.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Quick Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: '🛒 Shop', href: '/' },
                { label: '📦 My Orders', href: '/orders' },
                { label: '📞 Contact Us', href: '#contact' },
              ].map(l => (
                <a key={l.href} href={l.href}
                  style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textDecoration: 'none',
                    transition: 'color .2s' }}
                  onMouseEnter={e => e.target.style.color = '#fff'}
                  onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,0.7)'}>
                  {l.label}
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div id="contact">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Contact Us</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {PHONE && (
                <a href={`tel:${PHONE}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 13, color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>📞</span>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>Phone</div>
                    <div>{PHONE}</div>
                  </div>
                </a>
              )}

              {EMAIL && (
                <a href={`mailto:${EMAIL}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 13, color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>✉️</span>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>Email</div>
                    <div>{EMAIL}</div>
                  </div>
                </a>
              )}

              {(PHONE || WHATSAPP) && (
                <a href={waHref} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 10,
                    fontSize: 13, color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
                  <span style={{ width: 32, height: 32, borderRadius: '50%',
                    background: '#25D366', display: 'flex',
                    alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 32 32" width="16" height="16" fill="white">
                      <path d="M16 .5C7.44.5.5 7.44.5 16c0 2.77.72 5.37 1.98 7.63L.5 31.5l8.1-2.12A15.47 15.47 0 0016 31.5C24.56 31.5 31.5 24.56 31.5 16S24.56.5 16 .5zm7.34 19.43c-.4-.2-2.38-1.17-2.75-1.3-.37-.14-.63-.2-.9.2-.26.4-1.02 1.3-1.25 1.57-.23.27-.46.3-.86.1-.4-.2-1.68-.62-3.2-1.97-1.18-1.05-1.98-2.35-2.21-2.75-.23-.4-.02-.61.17-.81.18-.18.4-.46.6-.7.2-.23.26-.4.4-.66.13-.27.07-.5-.03-.7-.1-.2-.9-2.17-1.23-2.97-.32-.78-.65-.67-.9-.68h-.76c-.27 0-.7.1-1.06.5-.37.4-1.4 1.37-1.4 3.33 0 1.97 1.43 3.87 1.63 4.13.2.27 2.82 4.3 6.83 6.03.95.41 1.7.66 2.28.84.96.3 1.83.26 2.52.16.77-.12 2.38-.97 2.72-1.91.33-.94.33-1.75.23-1.91-.1-.17-.37-.27-.77-.47z"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 1 }}>WhatsApp</div>
                    <div>Chat with us</div>
                  </div>
                </a>
              )}

            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            © {new Date().getFullYear()} Green Roots Farm. All rights reserved.
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
            🌱 Grown with love, delivered with care
          </div>
        </div>
      </div>
    </footer>
  )
}
