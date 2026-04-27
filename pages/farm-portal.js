import { useState, useEffect, useRef } from 'react'
import { useRouter }                   from 'next/router'
import Head                            from 'next/head'
import { supabase }                    from '../lib/supabase'
import { sendOrderNotifications }      from '../lib/notifications'

const serif = { fontFamily: 'Playfair Display, serif' }
const CATEGORIES     = ['Vegetables','Fruits','Herbs','Grains','Dairy','Others']
const UNITS          = ['kg','g','piece','bunch','dozen','litre','pack','box']
const BUCKET         = 'product-images'
const ORDER_STATUSES = ['Confirmed','Preparing','Out for Delivery','Delivered','Cancelled']
const LOW_STOCK      = 5
const BLANK = { id:'', name:'', price:'', unit:'kg', category:'Vegetables', description:'',
  image_url:'', in_stock:true, is_visible:true, quantity_options:[], stock_quantity:'',
  min_order_value:'', points_per_unit:'0' }

const PRESETS = {
  'kg options':    [{ label:'250g', multiplier:0.25 },{ label:'500g', multiplier:0.5 },{ label:'1 kg', multiplier:1 },{ label:'2 kg', multiplier:2 }],
  'litre options': [{ label:'250 ml', multiplier:0.25 },{ label:'500 ml', multiplier:0.5 },{ label:'1 litre', multiplier:1 }],
  'piece options': [{ label:'1 piece', multiplier:1 },{ label:'2 pieces', multiplier:2 },{ label:'5 pieces', multiplier:5 }],
}

export default function FarmPortal() {
  const router  = useRouter()
  const fileRef = useRef(null)

  const [user, setUser]         = useState(null)
  const [farm, setFarm]         = useState(null)
  const [tab, setTab]           = useState('products')
  const [products, setProducts] = useState([])
  const [orders, setOrders]     = useState([])
  const [form, setForm]         = useState(BLANK)
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageFile, setImageFile] = useState(null)
  const [toast, setToast]       = useState('')
  const [updatingOrder, setUpdatingOrder] = useState(null)
  const [cancelModal, setCancelModal]   = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      const u = session?.user ?? null
      if (!u) { router.replace('/'); return }
      setUser(u)

      // Get profile role + owned_farm_id
      const { data: profile } = await supabase.from('profiles')
        .select('role, owned_farm_id').eq('id', u.id).single()

      if (!profile || (profile.role !== 'farm_owner' && profile.role !== 'admin')) {
        router.replace('/'); return
      }

      // Load farm details
      const { data: farmData } = await supabase.from('farms')
        .select('*').eq('id', profile.owned_farm_id).single()
      if (!farmData) { router.replace('/'); return }
      setFarm(farmData)

      // Load products + orders
      loadProducts(farmData.id)
      loadOrders(farmData.id)
      setLoading(false)
    })
  }, [])

  async function loadProducts(farmId) {
    const { data } = await supabase.from('products').select('*')
      .eq('farm_id', farmId).order('created_at', { ascending:false })
    setProducts(data||[])
  }

  async function loadOrders(farmId) {
    const { data } = await supabase.from('orders').select('*')
      .eq('farm_id', farmId).order('created_at', { ascending:false })
    setOrders(data||[])
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function onFileChange(e) {
    const file = e.target.files[0]; if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please select an image'); return }
    if (file.size > 5*1024*1024) { showToast('Image must be under 5MB'); return }
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }

  async function uploadImage(file) {
    const ext = file.name.split('.').pop()
    const fileName = `product_${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { contentType: file.type })
    if (error) throw error
    return supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl
  }

  function addOption() { set('quantity_options', [...(form.quantity_options||[]), { label:'', multiplier:1 }]) }
  function updateOption(idx, field, val) {
    const opts = [...(form.quantity_options||[])]
    opts[idx] = { ...opts[idx], [field]: field === 'multiplier' ? parseFloat(val)||0 : val }
    set('quantity_options', opts)
  }
  function removeOption(idx) { set('quantity_options', (form.quantity_options||[]).filter((_,i) => i!==idx)) }

 async function saveProduct() {
  if (!form.name || !form.price) { showToast('Name and price are required'); return }
  if (!form.image_url && !imageFile) { showToast('Please upload a product photo'); return }
  setSaving(true)
  try {
    let imageUrl = form.image_url
    if (imageFile) { setUploading(true); imageUrl = await uploadImage(imageFile); setUploading(false) }
    const qty_opts = (form.quantity_options||[]).filter(o => o.label && o.multiplier > 0)
    const stockQty = form.stock_quantity === '' ? null : parseFloat(form.stock_quantity)
    const payload = {
      name: form.name, description: form.description, price: parseFloat(form.price),
      unit: form.unit, category: form.category, image_url: imageUrl,
      in_stock: form.in_stock, is_visible: form.is_visible !== false,
      quantity_options: qty_opts.length > 0 ? qty_opts : null,
      stock_quantity: stockQty,
      min_order_value: form.min_order_value === '' ? null : parseFloat(form.min_order_value),
      points_per_unit: parseInt(form.points_per_unit) || 0,
    }

    // Get session token
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    const res = await fetch('/api/farm-portal/products', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(editing ? { id: form.id, ...payload } : payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    showToast(editing ? '✅ Product updated!' : '✅ Product added!')
    resetForm(); loadProducts(farm.id)
  } catch (e) { showToast('Error: ' + e.message) }
  finally { setSaving(false); setUploading(false) }
}
  function resetForm() {
    setForm(BLANK); setEditing(false); setImageFile(null); setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function startEdit(prod) {
    setForm({ ...prod, price: String(prod.price), quantity_options: prod.quantity_options||[],
      stock_quantity: prod.stock_quantity??'', is_visible: prod.is_visible !== false,
      min_order_value: prod.min_order_value??'', points_per_unit: prod.points_per_unit||0 })
    setEditing(true); setImagePreview(prod.image_url||null); setImageFile(null); setTab('products')
    window.scrollTo({ top:0, behavior:'smooth' })
  }

 async function deleteProduct(id, imageUrl) {
  if (!confirm('Delete this product?')) return
  if (imageUrl) await supabase.storage.from(BUCKET).remove([imageUrl.split('/').pop()])
  const { data: { session } } = await supabase.auth.getSession()
  await fetch('/api/farm-portal/products', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
    body: JSON.stringify({ id }),
  })
  showToast('Product removed'); loadProducts(farm.id)
}

  async function updateOrderStatus(order, newStatus) {
    if (newStatus === 'Cancelled') { setCancelModal(order); setCancelReason(''); return }
    await doUpdateStatus(order, newStatus, null)
  }

  async function confirmCancellation() {
    if (!cancelModal) return
    await doUpdateStatus(cancelModal, 'Cancelled', cancelReason)
    setCancelModal(null); setCancelReason('')
  }

  async function doUpdateStatus(order, newStatus, reason) {
    setUpdatingOrder(order.id)
    const { error } = await supabase.from('orders').update({
      status: newStatus, cancel_reason: reason || null, updated_at: new Date().toISOString()
    }).eq('id', order.id)
    if (error) { showToast('Failed: ' + error.message); setUpdatingOrder(null); return }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    await sendOrderNotifications({ ...order, cancel_reason: reason }, newStatus)
    showToast(`Status → ${newStatus}. Customer notified!`)
    setUpdatingOrder(null)
  }

  function stockBadge(p) {
    if (p.stock_quantity === null || p.stock_quantity === undefined) return null
    if (p.stock_quantity === 0) return { label:'Out of stock', bg:'var(--red-pale)', color:'var(--red)' }
    if (p.stock_quantity <= LOW_STOCK) return { label:`Only ${p.stock_quantity} left`, bg:'var(--gold-pale)', color:'var(--gold)' }
    return { label:`${p.stock_quantity} in stock`, bg:'var(--green-pale)', color:'var(--green)' }
  }

  const revenue = orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + Number(o.total), 0)
  const previewSrc = imagePreview || form.image_url
  const opts = form.quantity_options || []
  const basePrice = parseFloat(form.price) || 0

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans, sans-serif' }}>
      <div style={{ textAlign:'center', color:'var(--muted)' }}>
        <div style={{ fontSize:36, marginBottom:12 }}>🌿</div>Loading your farm portal…
      </div>
    </div>
  )

  return (
    <>
      <Head><title>{farm?.name || 'Farm Portal'} — Manager</title></Head>

      {/* Header */}
      <div style={{ background:'var(--card)', borderBottom:'1px solid var(--border)', padding:'14px 24px',
        display:'flex', justifyContent:'space-between', alignItems:'center', fontFamily:'DM Sans, sans-serif' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:22 }}>🌿</span>
          <div>
            <div style={{ ...serif, fontSize:16, fontWeight:700, color:'var(--green)' }}>{farm?.name}</div>
            <div style={{ fontSize:11, color:'var(--muted)' }}>Farm Portal</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <span style={{ fontSize:13, color:'var(--muted)' }}>{user?.email}</span>
          <button onClick={() => router.push('/?portal=1')}
            style={{ fontSize:12, padding:'6px 14px', border:'1px solid var(--border)',
              borderRadius:8, background:'transparent', cursor:'pointer' }}>🛒 View Shop</button>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/') }}
            style={{ fontSize:12, padding:'6px 14px', border:'1px solid var(--border)',
              borderRadius:8, background:'transparent', cursor:'pointer', color:'var(--muted)' }}>Logout</button>
        </div>
      </div>

      <main style={{ maxWidth:1120, margin:'0 auto', padding:'28px 20px', fontFamily:'DM Sans, sans-serif' }}>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:24 }}>
          {[
            { label:'My Products', value: products.length, icon:'🌿' },
            { label:'Total Orders', value: orders.length, icon:'📦' },
            { label:'Revenue', value: '₹' + revenue.toLocaleString('en-IN'), icon:'💰' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:26 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:20, fontWeight:700, color:'var(--green)' }}>{s.value}</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'2px solid var(--border)', marginBottom:24 }}>
          {['products','orders'].map(t => (
            <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={() => setTab(t)}>
              {t === 'products' ? '🌿 My Products' : '📦 My Orders'}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {tab === 'products' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 400px', gap:24, alignItems:'start' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>Products ({products.length})</div>
              {products.length === 0 ? (
                <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>🌱</div>
                  <div style={{ fontWeight:600 }}>No products yet — add your first one →</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                  {products.map(p => {
                    const sb = stockBadge(p)
                    return (
                      <div key={p.id} className="card" style={{ padding:'12px 16px', display:'flex',
                        alignItems:'center', gap:12, opacity: p.is_visible===false ? 0.55 : 1 }}>
                        <div style={{ width:52, height:52, borderRadius:10, overflow:'hidden',
                          background:'var(--green-pale)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ fontSize:26 }}>🌿</span>}
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:600, fontSize:14 }}>{p.name}</span>
                            {p.is_visible===false && <span style={{ fontSize:10, background:'#eee', color:'#888', padding:'2px 7px', borderRadius:8, fontWeight:600 }}>Hidden</span>}
                            {!p.in_stock && <span style={{ fontSize:10, background:'var(--red-pale)', color:'var(--red)', padding:'2px 7px', borderRadius:8, fontWeight:600 }}>Out of stock</span>}
                            {sb && <span style={{ fontSize:10, background:sb.bg, color:sb.color, padding:'2px 7px', borderRadius:8, fontWeight:600 }}>{sb.label}</span>}
                          </div>
                          <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                            {p.category} · <span style={{ color:'var(--green)', fontWeight:600 }}>₹{p.price}</span>/{p.unit}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => startEdit(p)} style={{ padding:'5px 12px', border:'1px solid var(--border)', borderRadius:7, background:'transparent', cursor:'pointer', fontSize:12 }}>Edit</button>
                          <button onClick={() => deleteProduct(p.id, p.image_url)} style={{ padding:'5px 12px', border:'1px solid var(--border)', borderRadius:7, background:'transparent', cursor:'pointer', fontSize:12, color:'var(--red)' }}>Delete</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Product Form */}
            <div className="card" style={{ padding:22, position:'sticky', top:80, maxHeight:'calc(100vh - 100px)', overflowY:'auto' }}>
              <div style={{ fontWeight:700, fontSize:16, color:'var(--green)', marginBottom:18 }}>
                {editing ? '✏️ Edit Product' : '＋ Add New Product'}
              </div>

              {/* Image upload */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:8 }}>Product Photo *</div>
                <div onClick={() => fileRef.current?.click()}
                  style={{ width:'100%', height:130, borderRadius:12, overflow:'hidden',
                    border:`2px dashed ${previewSrc ? 'var(--green)' : 'var(--border)'}`,
                    background: previewSrc ? 'transparent' : 'var(--green-pale)',
                    display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', position:'relative' }}>
                  {previewSrc
                    ? <img src={previewSrc} alt="preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    : <div style={{ textAlign:'center', color:'var(--muted)' }}>
                        <div style={{ fontSize:24, marginBottom:4 }}>📷</div>
                        <div style={{ fontSize:12 }}>Click to upload · Max 5MB</div>
                      </div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{ display:'none' }} />
                {uploading && <div style={{ fontSize:12, color:'var(--green)', marginTop:4 }}>⏳ Uploading…</div>}
              </div>

              {[{ label:'Product Name *', key:'name', placeholder:'e.g. Country Eggs' },
                { label:'Description', key:'description', placeholder:'Short description…', area:true }].map(f => (
                <div key={f.key} style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>{f.label}</div>
                  {f.area
                    ? <textarea className="inp" rows={2} value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                    : <input className="inp" value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                  }
                </div>
              ))}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Price (₹) *</div>
                  <input className="inp" type="number" min="0" step="0.5" value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Unit</div>
                  <select className="inp" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Category</div>
                <select className="inp" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Stock Quantity <span style={{ fontWeight:400 }}>(blank = unlimited)</span></div>
                <input className="inp" type="number" min="0" step="0.5" value={form.stock_quantity}
                  onChange={e => set('stock_quantity', e.target.value)} placeholder="e.g. 50" />
              </div>

              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Min Order Value (₹) <span style={{ fontWeight:400 }}>— optional</span></div>
                <input className="inp" type="number" min="0" step="1" value={form.min_order_value}
                  onChange={e => set('min_order_value', e.target.value)} placeholder="e.g. 50" />
              </div>

              <div style={{ marginBottom:14, display:'flex', gap:16 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={form.in_stock} onChange={e => set('in_stock', e.target.checked)}
                    style={{ width:15, height:15, accentColor:'var(--green)' }} />
                  In stock
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="checkbox" checked={form.is_visible !== false} onChange={e => set('is_visible', e.target.checked)}
                    style={{ width:15, height:15, accentColor:'var(--green)' }} />
                  Visible on shop
                </label>
              </div>

              {/* Size options */}
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:14, marginBottom:16 }}>
                <div style={{ fontWeight:600, fontSize:13, marginBottom:8 }}>Size Options</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:8 }}>
                  {Object.entries(PRESETS).map(([k, v]) => (
                    <button key={k} onClick={() => set('quantity_options', v)}
                      style={{ fontSize:11, padding:'4px 10px', borderRadius:20, border:'1.5px solid var(--border)',
                        background:'var(--green-pale)', color:'var(--green)', cursor:'pointer' }}>{k}</button>
                  ))}
                  {opts.length > 0 && <button onClick={() => set('quantity_options', [])}
                    style={{ fontSize:11, padding:'4px 10px', borderRadius:20, border:'1.5px solid var(--border)',
                      background:'var(--red-pale)', color:'var(--red)', cursor:'pointer' }}>clear</button>}
                </div>
                {opts.map((opt, i) => (
                  <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 80px 28px', gap:6, marginBottom:6 }}>
                    <input className="inp" style={{ padding:'6px 10px', fontSize:13 }} value={opt.label}
                      placeholder="e.g. 500g" onChange={e => updateOption(i, 'label', e.target.value)} />
                    <input className="inp" type="number" min="0.1" step="0.05"
                      style={{ padding:'6px 10px', fontSize:13 }} value={opt.multiplier}
                      onChange={e => updateOption(i, 'multiplier', e.target.value)} />
                    <button onClick={() => removeOption(i)}
                      style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--border)',
                        background:'transparent', cursor:'pointer', color:'var(--red)', fontSize:14 }}>✕</button>
                  </div>
                ))}
                {basePrice > 0 && opts.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:6 }}>
                    {opts.filter(o => o.label && o.multiplier > 0).map((o, i) => (
                      <span key={i} style={{ fontSize:11, background:'var(--green-pale)', padding:'3px 10px',
                        borderRadius:12, color:'var(--green)', fontWeight:600 }}>
                        {o.label} — ₹{(basePrice*o.multiplier).toFixed(0)}
                      </span>
                    ))}
                  </div>
                )}
                <button onClick={addOption}
                  style={{ fontSize:12, padding:'6px 14px', border:'1.5px dashed var(--green)',
                    borderRadius:8, background:'transparent', color:'var(--green)', cursor:'pointer', marginTop:8 }}>
                  ＋ Add option
                </button>
              </div>

              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-g" style={{ flex:1, padding:10 }} onClick={saveProduct} disabled={saving||uploading}>
                  {uploading ? 'Uploading…' : saving ? 'Saving…' : editing ? '💾 Update' : '＋ Add Product'}
                </button>
                {editing && <button className="btn-o" style={{ padding:'10px 14px' }} onClick={resetForm}>Cancel</button>}
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === 'orders' && (
          <div>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>My Orders ({orders.length})</div>
            {orders.length === 0 ? (
              <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>📦</div>
                <div style={{ fontWeight:600 }}>No orders yet</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {orders.map(o => (
                  <div key={o.id} className="card" style={{ padding:18 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:15 }}>{o.customer_name || o.user_email}</div>
                        <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                          #{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleString('en-IN')}
                        </div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>📍 {o.address}</div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>📞 {o.phone}</div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>
                          {o.payment_method === 'razorpay'
                            ? o.payment_status === 'paid' ? '💳 Paid Online ✓' : '⏳ Online Payment Pending'
                            : '💵 Cash on Delivery'}
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ ...serif, fontSize:20, fontWeight:700, color:'var(--green)', marginBottom:8 }}>
                          ₹{Number(o.total).toFixed(2)}
                        </div>
                        <select value={o.status} disabled={updatingOrder === o.id}
                          onChange={e => updateOrderStatus(o, e.target.value)}
                          style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--green)',
                            background:'var(--green-pale)', color:'var(--green)', fontWeight:600,
                            fontSize:12, cursor:'pointer', minWidth:160 }}>
                          {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                        {updatingOrder === o.id && <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Notifying…</div>}
                      </div>
                    </div>
                    <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
                      {(o.items||[]).map((item, i) => (
                        <span key={i} style={{ fontSize:12, background:'var(--bg)', padding:'3px 10px', borderRadius:12 }}>
                          {item.name}{item.selected_option ? ` (${item.selected_option})` : ''} × {item.qty} — ₹{((item.effective_price??item.price)*item.qty).toFixed(0)}
                        </span>
                      ))}
                    </div>
                    {o.notes && (
                      <div style={{ marginTop:8, fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>
                        📝 {o.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'var(--text)', color:'#fff', padding:'11px 22px', borderRadius:12,
          fontSize:13, zIndex:999, whiteSpace:'nowrap', fontWeight:500 }}>
          {toast}
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModal && (
        <div className="overlay" onClick={e => e.target === e.currentTarget && setCancelModal(null)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div style={{ ...serif, fontSize:18, fontWeight:700, color:'var(--red)' }}>❌ Cancel Order</div>
              <button onClick={() => setCancelModal(null)}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'var(--muted)' }}>✕</button>
            </div>
            <div style={{ fontSize:13, fontWeight:600, marginBottom:8 }}>Reason (sent to customer)</div>
            <textarea className="inp" rows={3} value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="e.g. Item currently out of stock…" style={{ marginBottom:14 }} />
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setCancelModal(null)} className="btn-o" style={{ flex:1, padding:10 }}>Keep</button>
              <button onClick={confirmCancellation} disabled={updatingOrder === cancelModal?.id}
                style={{ flex:1, padding:10, background:'var(--red)', color:'#fff', border:'none',
                  borderRadius:9, cursor:'pointer', fontSize:14, fontWeight:500 }}>
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
