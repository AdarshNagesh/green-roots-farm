import { useState } from 'react'
import { supabase } from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function CartSidebar({ cart, user, onClose, onUpdateQty, onClearCart }) {
  const [checkout, setCheckout] = useState(false)
  const [form, setForm]         = useState({ name: '', address: '', phone: '' })
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const count = cart.reduce((s, i) => s + i.qty, 0)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function placeOrder() {
    if (!form.name || !form.address || !form.phone) { alert('Please fill all fields'); return }
    setLoading(true)
    const { error } = await supabase.from('orders').insert({
      user_id: user.id,
      user_email: user.email,
      customer_name: form.name,
      address: form.address,
      phone: form.phone,
      items: cart,
      total,
      status: 'Confirmed',
    })
    setLoading(false)
    if (error) { alert('Order failed: ' + error.message); return }
    setDone(true)
    onClearCart()
    setTimeout(() => { setDone(false); setCheckout(false); onClose(); }, 2500)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)' }} />
      <div style={{ position: 'relative', background: 'var(--card)', width: 400,
        height: '100%', overflowY: 'auto', padding: 26,
        boxShadow: '-4px 0 28px rgba(0,0,0,.12)' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <div style={{ ...serif, fontSize: 22, fontWeight: 700 }}>🛒 Your Cart</div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)' }}>✕</button>
        </div>

        {done ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>✅</div>
            <div style={{ ...serif, fontSize: 22, fontWeight: 700, color: 'var(--green)', marginBottom: 8 }}>
              Order Placed!
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>
              We'll contact you at {form.phone} to confirm delivery.
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🧺</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Your cart is empty</div>
            <div style={{ fontSize: 13 }}>Add some fresh produce!</div>
            <button className="btn-g" style={{ marginTop: 16 }} onClick={onClose}>Browse Products</button>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              {cart.map(item => (
                <CartItem key={item.id} item={item} onUpdateQty={onUpdateQty} />
              ))}
            </div>

            {/* Total */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--muted)' }}>{count} item{count !== 1 ? 's' : ''} · Total</span>
                <span style={{ ...serif, fontSize: 22, fontWeight: 700, color: 'var(--green)' }}>
                  ₹{total.toFixed(2)}
                </span>
              </div>
            </div>

            {!checkout ? (
              <button className="btn-g" style={{ width: '100%', padding: 13, fontSize: 15 }}
                onClick={() => setCheckout(true)}>
                Proceed to Checkout →
              </button>
            ) : (
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14, color: 'var(--green)' }}>
                  📍 Delivery Details
                </div>
                {[
                  { label: 'Your Name *', key: 'name', placeholder: 'Full name', type: 'text' },
                  { label: 'Phone *', key: 'phone', placeholder: '+91 00000 00000', type: 'tel' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 11 }}>
                    <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>{f.label}</div>
                    <input className="inp" type={f.type} value={form[f.key]}
                      onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                  </div>
                ))}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>
                    Delivery Address *
                  </div>
                  <textarea className="inp" rows={3} value={form.address}
                    onChange={e => set('address', e.target.value)}
                    placeholder="Door no, street, city, pincode…" />
                </div>
                <button className="btn-g" style={{ width: '100%', padding: 13, marginBottom: 8, fontSize: 15 }}
                  onClick={placeOrder} disabled={loading}>
                  {loading ? 'Placing…' : `✓ Place Order · ₹${total.toFixed(2)}`}
                </button>
                <button className="btn-o" style={{ width: '100%', padding: 10 }}
                  onClick={() => setCheckout(false)}>← Back to Cart</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function CartItem({ item, onUpdateQty }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11,
      padding: '11px 13px', background: 'var(--bg)', borderRadius: 12 }}>
      <span style={{ fontSize: 26 }}>{item.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500, fontSize: 13 }}>{item.name}</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>₹{item.price}/{item.unit}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {['−', '+'].map((sym, i) => (
          <button key={sym} onClick={() => onUpdateQty(item.id, item.qty + (i === 0 ? -1 : 1))}
            style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--card)', cursor: 'pointer', fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {sym}
          </button>
        ))}
        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 22, textAlign: 'center', margin: '0 2px' }}>
          {item.qty}
        </span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, minWidth: 48, textAlign: 'right', color: 'var(--green)' }}>
        ₹{(item.price * item.qty).toFixed(0)}
      </div>
    </div>
  )
}
