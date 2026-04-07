import { useState, useEffect } from 'react'
import { supabase }            from '../lib/supabase'
import { sendOrderNotifications } from '../lib/notifications'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function CartSidebar({ cart, user, onClose, onUpdateQty, onClearCart }) {
  const [step, setStep]         = useState('cart')
  const [payMode, setPayMode]   = useState('cod')
  const [form, setForm]         = useState({ name:'', address:'', phone:'' })
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [rzpReady, setRzpReady] = useState(false)

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0)
  const count = cart.reduce((s, i) => s + i.qty, 0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (document.getElementById('rzp-script')) { setRzpReady(true); return }
    const s    = document.createElement('script')
    s.id       = 'rzp-script'
    s.src      = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload   = () => setRzpReady(true)
    document.body.appendChild(s)
  }, [])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function createDBOrder(paymentMethod, paymentStatus) {
    const { data, error: err } = await supabase.from('orders').insert({
      user_id:        user.id,
      user_email:     user.email,
      customer_name:  form.name,
      address:        form.address,
      phone:          form.phone,
      items:          cart,
      total,
      status:         paymentMethod === 'cod' ? 'Confirmed' : 'Payment Pending',
      payment_status: paymentStatus,
      payment_method: paymentMethod,
    }).select().single()
    if (err) throw err
    return data
  }

  async function handleCOD() {
    if (!form.name || !form.address || !form.phone) { setError('Please fill all fields'); return }
    setLoading(true)
    try {
      const order = await createDBOrder('cod', 'pending')
      await sendOrderNotifications({ ...order, customer_name: form.name, address: form.address, phone: form.phone, user_email: user.email }, 'Confirmed')
      onClearCart(); setStep('done')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleRazorpay() {
    if (!form.name || !form.address || !form.phone) { setError('Please fill all fields'); return }
    if (!rzpReady) { setError('Payment SDK not loaded yet — please try again.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total }),
      })
      const rzpOrder = await res.json()
      if (!res.ok) throw new Error(rzpOrder.error)

      const dbOrder = await createDBOrder('razorpay', 'pending')

      const options = {
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount:      rzpOrder.amount,
        currency:    rzpOrder.currency,
        name:        'Green Roots Farm',
        description: 'Fresh Organic Produce',
        order_id:    rzpOrder.orderId,
        prefill:     { name: form.name, email: user.email, contact: form.phone },
        theme:       { color: '#2d6a27' },
        handler: async (response) => {
          const vRes = await fetch('/api/razorpay/verify-payment', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...response, order_id: dbOrder.id }),
          })
          const vData = await vRes.json()
          if (!vData.success) { setError('Payment verification failed. Contact support.'); return }
          await sendOrderNotifications({ ...dbOrder, customer_name: form.name, address: form.address, phone: form.phone, user_email: user.email }, 'Confirmed')
          onClearCart(); setStep('done')
        },
        modal: { ondismiss: () => setLoading(false) },
      }
      new window.Razorpay(options).open()
      setLoading(false)
    } catch (e) { setError(e.message); setLoading(false) }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, display:'flex', justifyContent:'flex-end' }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.42)' }} />
      <div style={{ position:'relative', background:'var(--card)', width:420, height:'100%',
        overflowY:'auto', padding:26, boxShadow:'-4px 0 28px rgba(0,0,0,.12)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
          <div style={{ ...serif, fontSize:22, fontWeight:700 }}>
            {step==='cart' ? '🛒 Cart' : step==='checkout' ? '📍 Checkout' : ''}
          </div>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--muted)' }}>✕</button>
        </div>

        {step==='done' && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
            <div style={{ ...serif, fontSize:22, fontWeight:700, color:'var(--green)', marginBottom:8 }}>Order Placed!</div>
            <div style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7 }}>
              Confirmation sent to <strong>{user.email}</strong>.<br/>SMS update on the way!
            </div>
            <button className="btn-g" style={{ marginTop:22 }} onClick={onClose}>Continue Shopping</button>
          </div>
        )}

        {step==='cart' && cart.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted)' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🧺</div>
            <div style={{ fontWeight:600, marginBottom:6 }}>Cart is empty</div>
            <button className="btn-g" style={{ marginTop:12 }} onClick={onClose}>Browse Products</button>
          </div>
        )}

        {step==='cart' && cart.length>0 && <>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
            {cart.map(item => <CartItem key={item.id} item={item} onUpdateQty={onUpdateQty} />)}
          </div>
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:16, marginBottom:20,
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:14, color:'var(--muted)' }}>{count} item{count!==1?'s':''}</span>
            <span style={{ ...serif, fontSize:22, fontWeight:700, color:'var(--green)' }}>₹{total.toFixed(2)}</span>
          </div>
          <button className="btn-g" style={{ width:'100%', padding:13, fontSize:15 }}
            onClick={() => setStep('checkout')}>Proceed to Checkout →</button>
        </>}

        {step==='checkout' && <div>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Delivery Details</div>
          {[
            { label:'Full Name *',    key:'name',  placeholder:'Your name', type:'text' },
            { label:'Phone *',        key:'phone', placeholder:'+91 98765 43210', type:'tel' },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:11 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>{f.label}</div>
              <input className="inp" type={f.type} value={form[f.key]}
                onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            </div>
          ))}
          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Address *</div>
            <textarea className="inp" rows={3} value={form.address}
              onChange={e => set('address', e.target.value)} placeholder="Door no, street, city, pincode…" />
          </div>

          <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Payment Method</div>
          <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:18 }}>
            {[
              { id:'cod',      label:'💵 Cash on Delivery', desc:'Pay when your order arrives' },
              { id:'razorpay', label:'💳 Pay Online',        desc:'UPI · Cards · Net Banking via Razorpay' },
            ].map(opt => (
              <label key={opt.id} style={{
                display:'flex', alignItems:'center', gap:12, padding:'13px 16px',
                border:`2px solid ${payMode===opt.id ? 'var(--green)' : 'var(--border)'}`,
                borderRadius:12, cursor:'pointer', transition:'all .2s',
                background: payMode===opt.id ? 'var(--green-pale)' : 'transparent',
              }}>
                <input type="radio" name="payment" value={opt.id} checked={payMode===opt.id}
                  onChange={() => setPayMode(opt.id)}
                  style={{ accentColor:'var(--green)', width:16, height:16 }} />
                <div>
                  <div style={{ fontWeight:600, fontSize:14 }}>{opt.label}</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ padding:'12px 16px', background:'var(--green-pale)', borderRadius:10, marginBottom:14,
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:600, fontSize:14 }}>Order Total</span>
            <span style={{ ...serif, fontSize:20, fontWeight:700, color:'var(--green)' }}>₹{total.toFixed(2)}</span>
          </div>

          {error && <div style={{ fontSize:13, color:'var(--red)', marginBottom:12,
            padding:'9px 12px', background:'var(--red-pale)', borderRadius:9 }}>{error}</div>}

          <button className="btn-g" style={{ width:'100%', padding:13, fontSize:15, marginBottom:8 }}
            disabled={loading}
            onClick={payMode==='cod' ? handleCOD : handleRazorpay}>
            {loading ? 'Processing…' : payMode==='cod' ? '✓ Place Order (COD)' : `🔒 Pay ₹${total.toFixed(2)} Online`}
          </button>
          <button className="btn-o" style={{ width:'100%', padding:10 }}
            onClick={() => setStep('cart')}>← Back to Cart</button>
        </div>}
      </div>
    </div>
  )
}

function CartItem({ item, onUpdateQty }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11,
      padding:'11px 13px', background:'var(--bg)', borderRadius:12 }}>
      <div style={{ width:44, height:44, borderRadius:8, overflow:'hidden',
        background:'var(--green-pale)', flexShrink:0,
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {item.image_url
          ? <img src={item.image_url} alt={item.name}
              style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontSize:22 }}>{item.emoji || '🌿'}</span>
        }
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:500, fontSize:13 }}>{item.name}</div>
        <div style={{ fontSize:12, color:'var(--muted)' }}>₹{item.price}/{item.unit}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        {['−','+'].map((sym,i) => (
          <button key={sym} onClick={() => onUpdateQty(item.id, item.qty+(i===0?-1:1))}
            style={{ width:26,height:26,borderRadius:7,border:'1px solid var(--border)',
              background:'var(--card)',cursor:'pointer',fontSize:15,
              display:'flex',alignItems:'center',justifyContent:'center' }}>{sym}</button>
        ))}
        <span style={{ fontSize:13,fontWeight:600,minWidth:22,textAlign:'center',margin:'0 2px' }}>{item.qty}</span>
      </div>
      <div style={{ fontWeight:700,fontSize:13,minWidth:48,textAlign:'right',color:'var(--green)' }}>
        ₹{(item.price*item.qty).toFixed(0)}
      </div>
    </div>
  )
}
