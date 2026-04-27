import { useState, useEffect } from 'react'
import { supabase }            from '../lib/supabase'
import { sendOrderNotifications } from '../lib/notifications'

const serif = { fontFamily: 'Playfair Display, serif' }

const ALLOWED_PINCODES = Array.from({ length: 30 }, (_, i) => String(570001 + i))

function extractPincode(address) {
  const match = address.match(/\b(5700\d{2})\b/)
  return match ? match[0] : null
}

function validatePincode(address) {
  const pin = extractPincode(address)
  if (!pin) return { valid: false, message: 'Please include your 6-digit pincode in the address.' }
  if (!ALLOWED_PINCODES.includes(pin)) return { valid: false, message: `Sorry, we only deliver within Mysore city (570001–570030). Your pincode ${pin} is outside our area.` }
  return { valid: true, message: '' }
}

function validateMinOrders(cart) {
  const errors = []
  for (const item of cart) {
    if (item.min_order_value && item.min_order_value > 0) {
      const itemTotal = (item.effective_price ?? item.price) * item.qty
      if (itemTotal < item.min_order_value) {
        errors.push(`${item.name}: min order ₹${item.min_order_value} (currently ₹${itemTotal.toFixed(0)})`)
      }
    }
  }
  return errors
}

export default function CartSidebar({ cart, user, onClose, onUpdateQty, onClearCart }) {
  const [step, setStep]           = useState('cart')
  const [payMode, setPayMode]     = useState('cod')
  const [form, setForm]           = useState({ name:'', address:'', phone:'', notes:'' })
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [rzpReady, setRzpReady]   = useState(false)
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false)

  // Points state
  const [pointsBalance, setPointsBalance] = useState(0)
  const [usePoints, setUsePoints]         = useState(false)
  const [pointsToRedeem, setPointsToRedeem] = useState(0)
const [pointsRate, setPointsRate] = useState(1)
  const baseTotal  = cart.reduce((s, i) => s + (i.effective_price ?? i.price) * i.qty, 0)
 const discount = usePoints ? Math.min(pointsToRedeem * pointsRate, baseTotal) : 0
  const total      = Math.max(0, baseTotal - discount)
  const count      = cart.reduce((s, i) => s + i.qty, 0)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (document.getElementById('rzp-script')) { setRzpReady(true); return }
    const s = document.createElement('script')
    s.id = 'rzp-script'; s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => setRzpReady(true)
    document.body.appendChild(s)
  }, [])

  // Fetch points balance when checkout step opens
useEffect(() => {
  if (user) {   // ← remove the step === 'checkout' condition
    fetch(`/api/credits/balance?user_id=${user.id}`)
      .then(r => r.json())
      .then(d => {
        setPointsBalance(d.points_balance || 0)
        setPointsToRedeem(d.points_balance || 0)
        setLoyaltyEnabled(d.loyalty_enabled || false)
      })
    fetch('/api/settings?key=points_to_rupee_rate')
      .then(r => r.json())
      .then(d => setPointsRate(parseFloat(d.value) || 1))
  }
}, [user])   // ← trigger on user, not step

  function setF(k, v) { setForm(f => ({ ...f, [k]: v })); setError('') }

  function validateCheckout() {
    if (!form.name || !form.address || !form.phone) return 'Please fill all required fields'
    const pc = validatePincode(form.address)
    if (!pc.valid) return pc.message
    const minErrors = validateMinOrders(cart)
    if (minErrors.length > 0) return 'Minimum order not met:\n' + minErrors.join('\n')
    return null
  }

  async function notifyAdmin(order) {
    try {
      await fetch('/api/notify/admin-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
      })
    } catch (e) { console.error('Admin notify failed:', e) }
  }

  async function awardPoints(orderId) {
    try {
      await fetch('/api/credits/earn', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, user_id: user.id }),
      })
    } catch (e) { console.error('Points award failed:', e) }
  }

  async function redeemPoints(orderId) {
    if (!usePoints || pointsToRedeem <= 0) return
    try {
      await fetch('/api/credits/redeem', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, points_to_redeem: pointsToRedeem, order_id: orderId }),
      })
    } catch (e) { console.error('Points redeem failed:', e) }
  }

  async function createDBOrder(paymentMethod, paymentStatus) {
    const items = cart.map(i => ({
      id: i.id, name: i.name, image_url: i.image_url || null,
      price: i.price, effective_price: i.effective_price ?? i.price,
      selected_option: i.selected_option || null, multiplier: i.multiplier || 1,
      unit: i.unit, qty: i.qty,
    }))
   const farmId = cart.find(i => i.farm_id)?.farm_id || null

const { data, error: err } = await supabase.from('orders').insert({
  user_id:        user.id,
  user_email:     user.email,
  customer_name:  form.name,
  address:        form.address,
  phone:          form.phone,
  notes:          form.notes || null,
  items,
  total,
  farm_id:        farmId,   // ← add this line
  points_redeemed: usePoints ? pointsToRedeem : 0,
  status:          paymentMethod === 'cod' ? 'Confirmed' : 'Payment Pending',
  payment_status:  paymentStatus,
  payment_method:  paymentMethod,
}).select().single()
    if (err) throw err
    return data
  }

  async function handleCOD() {
    const err = validateCheckout(); if (err) { setError(err); return }
    setLoading(true)
    try {
      const order = await createDBOrder('cod', 'pending')
      await redeemPoints(order.id)
      await Promise.all([
        sendOrderNotifications({ ...order, customer_name: form.name, address: form.address, phone: form.phone, notes: form.notes, user_email: user.email }, 'Confirmed'),
        notifyAdmin({ ...order, customer_name: form.name, address: form.address, phone: form.phone, notes: form.notes, user_email: user.email }),
        awardPoints(order.id),
      ])
      onClearCart(); setStep('done')
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleRazorpay() {
    const err = validateCheckout(); if (err) { setError(err); return }
    if (!rzpReady) { setError('Payment SDK not loaded — please try again.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total }),
      })
      const rzpOrder = await res.json()
      if (!res.ok) throw new Error(rzpOrder.error)
      const dbOrder = await createDBOrder('razorpay', 'pending')
      await redeemPoints(dbOrder.id)
      const options = {
        key:         process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount:      rzpOrder.amount, currency: rzpOrder.currency,
        name:        'Adarshini Organic Farm',
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
          await Promise.all([
            sendOrderNotifications({ ...dbOrder, customer_name: form.name, address: form.address, phone: form.phone, notes: form.notes, user_email: user.email }, 'Confirmed'),
            notifyAdmin({ ...dbOrder, customer_name: form.name, address: form.address, phone: form.phone, notes: form.notes, user_email: user.email }),
            awardPoints(dbOrder.id),
          ])
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

        {/* ── DONE ── */}
        {step==='done' && (
          <div style={{ textAlign:'center', padding:'60px 20px' }}>
            <div style={{ fontSize:52, marginBottom:16 }}>✅</div>
            <div style={{ ...serif, fontSize:22, fontWeight:700, color:'var(--green)', marginBottom:8 }}>Order Placed!</div>
            <div style={{ fontSize:14, color:'var(--muted)', lineHeight:1.7 }}>
              Confirmation sent to <strong>{user.email}</strong>.<br/>We'll be in touch shortly!
            </div>
            {usePoints && pointsToRedeem > 0 && (
              <div style={{ marginTop:14, padding:'10px 14px', background:'var(--green-pale)',
                borderRadius:10, fontSize:13, color:'var(--green)', fontWeight:500 }}>
                🎉 {pointsToRedeem} points redeemed — saved ₹{pointsToRedeem}!
              </div>
            )}
            <button className="btn-g" style={{ marginTop:22 }} onClick={onClose}>Continue Shopping</button>
          </div>
        )}

        {/* ── EMPTY ── */}
        {step==='cart' && cart.length===0 && (
          <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted)' }}>
            <div style={{ fontSize:44, marginBottom:12 }}>🧺</div>
            <div style={{ fontWeight:600, marginBottom:6 }}>Cart is empty</div>
            <button className="btn-g" style={{ marginTop:12 }} onClick={onClose}>Browse Products</button>
          </div>
        )}

        {/* ── CART ITEMS ── */}
        {step==='cart' && cart.length>0 && <>
          <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
           {cart.map(item => <CartItem key={item.cartKey||item.id} item={item} onUpdateQty={onUpdateQty} loyaltyEnabled={loyaltyEnabled} />)}
          </div>

          {validateMinOrders(cart).length > 0 && (
            <div style={{ marginBottom:14, padding:'10px 14px', background:'var(--gold-pale)',
              borderRadius:10, fontSize:12, color:'var(--gold)', lineHeight:1.6 }}>
              ⚠️ {validateMinOrders(cart).join(' · ')}
            </div>
          )}

          <div style={{ borderTop:'1px solid var(--border)', paddingTop:16, marginBottom:20,
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:14, color:'var(--muted)' }}>{count} item{count!==1?'s':''}</span>
            <span style={{ ...serif, fontSize:22, fontWeight:700, color:'var(--green)' }}>₹{baseTotal.toFixed(2)}</span>
          </div>
          <button className="btn-g" style={{ width:'100%', padding:13, fontSize:15 }}
            disabled={validateMinOrders(cart).length > 0}
            onClick={() => setStep('checkout')}>
            {validateMinOrders(cart).length > 0 ? 'Meet minimum order to proceed' : 'Proceed to Checkout →'}
          </button>
        </>}

        {/* ── CHECKOUT ── */}
        {step==='checkout' && <div>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Delivery Details</div>
          {[
            { label:'Full Name *',  key:'name',  placeholder:'Your name',         type:'text' },
            { label:'Phone *',      key:'phone', placeholder:'+91 98765 43210',   type:'tel'  },
          ].map(f => (
            <div key={f.key} style={{ marginBottom:11 }}>
              <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>{f.label}</div>
              <input className="inp" type={f.type} value={form[f.key]}
                onChange={e => setF(f.key, e.target.value)} placeholder={f.placeholder} />
            </div>
          ))}

          <div style={{ marginBottom:11 }}>
            <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>
              Address * <span style={{ fontWeight:400 }}>(include your 6-digit pincode)</span>
            </div>
            <textarea className="inp" rows={3} value={form.address}
              onChange={e => setF('address', e.target.value)}
              placeholder="Door no, street, area, Mysore — 570XXX" />
            {form.address.length > 10 && (() => {
              const pc = validatePincode(form.address)
              const pin = extractPincode(form.address)
              if (!pin) return <div style={{ fontSize:11, color:'var(--gold)', marginTop:4 }}>⚠️ Add your pincode (570001–570030)</div>
              if (!pc.valid) return <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>❌ {pc.message}</div>
              return <div style={{ fontSize:11, color:'var(--green)', marginTop:4 }}>✓ Pincode {pin} — we deliver here!</div>
            })()}
          </div>

          <div style={{ marginBottom:18 }}>
            <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>
              Delivery Note <span style={{ fontWeight:400 }}>(optional)</span>
            </div>
            <input className="inp" value={form.notes}
              onChange={e => setF('notes', e.target.value)}
              placeholder="e.g. Leave at gate · Call before delivery" />
          </div>

          {/* ── Points redemption ── */}
          {loyaltyEnabled && pointsBalance > 0 && (
            <div style={{ marginBottom:18, padding:'14px 16px',
              background: usePoints ? 'var(--green-pale)' : 'var(--bg)',
              borderRadius:12, border:`1.5px solid ${usePoints ? 'var(--green)' : 'var(--border)'}`,
              transition:'all .2s' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: usePoints ? 10 : 0 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'var(--green)' }}>
                    🎁 You have {pointsBalance} points (₹{(pointsBalance * pointsRate).toFixed(0)} off)
                  </div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                    Earn more points with every purchase
                  </div>
                </div>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <span style={{ fontSize:12, color:'var(--muted)', fontWeight:500 }}>
                    {usePoints ? 'Using' : 'Use'}
                  </span>
                  <div onClick={() => setUsePoints(!usePoints)}
                    style={{ width:40, height:22, borderRadius:11, background: usePoints ? 'var(--green)' : 'var(--border)',
                      position:'relative', cursor:'pointer', transition:'background .2s' }}>
                    <div style={{ position:'absolute', top:2, left: usePoints ? 20 : 2, width:18, height:18,
                      borderRadius:'50%', background:'#fff', transition:'left .2s',
                      boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
                  </div>
                </label>
              </div>
              {usePoints && (
                <div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                    <span style={{ fontSize:12, color:'var(--muted)' }}>Points to redeem</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--green)' }}>
                      −₹{Math.min(pointsToRedeem, baseTotal).toFixed(0)}
                    </span>
                  </div>
                  <input type="range" min={1} max={pointsBalance} value={pointsToRedeem}
                    onChange={e => setPointsToRedeem(Number(e.target.value))}
                    style={{ width:'100%', accentColor:'var(--green)' }} />
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--muted)', marginTop:3 }}>
                    <span>1 pt</span>
                    <span style={{ fontWeight:600, color:'var(--green)' }}>{pointsToRedeem} pts selected</span>
                    <span>{pointsBalance} pts</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment method */}
          <div style={{ fontWeight:600, fontSize:14, marginBottom:12 }}>Payment Method</div>
          <div style={{ display:'flex', flexDirection:'column', gap:9, marginBottom:18 }}>
            {[
              { id:'cod',      label:'💵 Cash on Delivery', desc:'Pay when your order arrives' },
              { id:'razorpay', label:'💳 Pay Online',        desc:'UPI · Cards · Net Banking'  },
            ].map(opt => (
              <label key={opt.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px',
                border:`2px solid ${payMode===opt.id ? 'var(--green)' : 'var(--border)'}`,
                borderRadius:12, cursor:'pointer', transition:'all .2s',
                background: payMode===opt.id ? 'var(--green-pale)' : 'transparent' }}>
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

          {/* Order total */}
          <div style={{ padding:'12px 16px', background:'var(--green-pale)', borderRadius:10,
            marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--muted)', marginBottom:4 }}>
              <span>Subtotal</span><span>₹{baseTotal.toFixed(2)}</span>
            </div>
            {usePoints && pointsToRedeem > 0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--green)', marginBottom:4 }}>
                <span>Points discount ({pointsToRedeem} pts)</span>
                <span>−₹{Math.min(pointsToRedeem, baseTotal).toFixed(0)}</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:700, borderTop:'1px solid var(--border)', paddingTop:6 }}>
              <span style={{ fontSize:15 }}>Total</span>
              <span style={{ ...serif, fontSize:20, color:'var(--green)' }}>₹{total.toFixed(2)}</span>
            </div>
          </div>

          {error && (
            <div style={{ fontSize:13, color:'var(--red)', marginBottom:12,
              padding:'10px 13px', background:'var(--red-pale)', borderRadius:9, whiteSpace:'pre-line' }}>
              {error}
            </div>
          )}

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

function CartItem({ item, onUpdateQty, loyaltyEnabled }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:11,
      padding:'11px 13px', background:'var(--bg)', borderRadius:12 }}>
      <div style={{ width:44, height:44, borderRadius:8, overflow:'hidden', background:'var(--green-pale)',
        flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {item.image_url
          ? <img src={item.image_url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontSize:22 }}>{item.emoji || '🌿'}</span>}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:500, fontSize:13 }}>{item.name}</div>
        <div style={{ fontSize:12, color:'var(--muted)' }}>
          {item.selected_option || `₹${item.price}/${item.unit}`}
          {item.selected_option && ` · ₹${(item.effective_price ?? item.price).toFixed(0)}`}
        </div>
        {loyaltyEnabled && item.points_per_unit > 0 && (
  <div style={{ fontSize:10, color:'var(--green)', fontWeight:500, marginTop:2 }}>
    🎁 Earn {Math.floor(item.points_per_unit * item.qty)} pts
  </div>
)}
        {item.min_order_value && (item.effective_price ?? item.price) * item.qty < item.min_order_value && (
          <div style={{ fontSize:10, color:'var(--gold)', marginTop:2 }}>
            Min order ₹{item.min_order_value}
          </div>
        )}
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
        {['−','+'].map((sym,i) => (
          <button key={sym} onClick={() => onUpdateQty(item.cartKey||item.id, item.qty+(i===0?-1:1))}
            style={{ width:26, height:26, borderRadius:7, border:'1px solid var(--border)',
              background:'var(--card)', cursor:'pointer', fontSize:15,
              display:'flex', alignItems:'center', justifyContent:'center' }}>{sym}</button>
        ))}
        <span style={{ fontSize:13, fontWeight:600, minWidth:22, textAlign:'center', margin:'0 2px' }}>{item.qty}</span>
      </div>
      <div style={{ fontWeight:700, fontSize:13, minWidth:48, textAlign:'right', color:'var(--green)' }}>
        ₹{((item.effective_price??item.price)*item.qty).toFixed(0)}
      </div>
    </div>
  )
}
