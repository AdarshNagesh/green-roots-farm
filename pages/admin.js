import { useState, useEffect, useRef } from 'react'
import { useRouter }                   from 'next/router'
import Head                            from 'next/head'
import { supabase, isAdmin }           from '../lib/supabase'
import { sendOrderNotifications }      from '../lib/notifications'
import Header                          from '../components/Header'

const serif = { fontFamily: 'Playfair Display, serif' }
const CATEGORIES    = ['Vegetables','Fruits','Herbs','Grains','Dairy','Others']
const UNITS         = ['kg','g','piece','bunch','dozen','litre','pack','box']
const BLANK         = { id:'', name:'', price:'', unit:'kg', category:'Vegetables', description:'', image_url:'', in_stock:true }
const ORDER_STATUSES = ['Confirmed','Preparing','Out for Delivery','Delivered','Cancelled']
const BUCKET        = 'product-images'

export default function AdminPage() {
  const router = useRouter()
  const fileRef = useRef(null)

  const [user, setUser]                   = useState(null)
  const [products, setProducts]           = useState([])
  const [orders, setOrders]               = useState([])
  const [customers, setCustomers]         = useState([])
  const [tab, setTab]                     = useState('products')
  const [form, setForm]                   = useState(BLANK)
  const [editing, setEditing]             = useState(false)
  const [saving, setSaving]               = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [imagePreview, setImagePreview]   = useState(null)
  const [imageFile, setImageFile]         = useState(null)
  const [toast, setToast]                 = useState('')
  const [updatingOrder, setUpdatingOrder] = useState(null)
  const [stats, setStats]                 = useState({ products:0, orders:0, customers:0, revenue:0 })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      if (!u || !isAdmin(u)) { router.replace('/'); return }
      setUser(u)
      loadAll()
    })
  }, [])

  async function loadAll() {
    const [p, o] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
    ])
    setProducts(p.data || [])
    setOrders(o.data || [])
    setStats({
      products: (p.data||[]).length,
      orders:   (o.data||[]).length,
      revenue:  (o.data||[]).reduce((s, o) => s + Number(o.total), 0),
      customers: 0,
    })
    loadCustomers()
  }

  async function loadCustomers() {
    const res = await fetch('/api/admin/customers')
    if (res.ok) {
      const data = await res.json()
      setCustomers(data)
      setStats(s => ({ ...s, customers: data.length }))
    }
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3500) }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  // ── Image handling ────────────────────────────────────────────────────────
  function onFileChange(e) {
    const file = e.target.files[0]
    if (!file) return

    // Validate type
    if (!file.type.startsWith('image/')) { showToast('Please select an image file'); return }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) { showToast('Image must be under 5MB'); return }

    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  function clearImage() {
    setImageFile(null)
    setImagePreview(null)
    set('image_url', '')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function uploadImage(file) {
    const ext      = file.name.split('.').pop()
    const fileName = `product_${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, file, { contentType: file.type, upsert: false })

    if (error) throw error

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName)
    return data.publicUrl
  }

  // ── Save product ──────────────────────────────────────────────────────────
  async function saveProduct() {
    if (!form.name || !form.price) { showToast('Name and price are required'); return }
    if (!form.image_url && !imageFile) { showToast('Please upload a product photo'); return }

    setSaving(true)
    try {
      let imageUrl = form.image_url

      // Upload new image if selected
      if (imageFile) {
        setUploading(true)
        imageUrl = await uploadImage(imageFile)
        setUploading(false)
      }

      const payload = {
        name:        form.name,
        description: form.description,
        price:       parseFloat(form.price),
        unit:        form.unit,
        category:    form.category,
        image_url:   imageUrl,
        in_stock:    form.in_stock,
      }

      const { error } = editing
        ? await supabase.from('products').update(payload).eq('id', form.id)
        : await supabase.from('products').insert(payload)

      if (error) throw error

      showToast(editing ? '✅ Updated — customers notified!' : '✅ Added — customers notified!')
      resetForm()
      loadAll()
    } catch (e) {
      showToast('Error: ' + e.message)
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  function resetForm() {
    setForm(BLANK)
    setEditing(false)
    setImageFile(null)
    setImagePreview(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function deleteProduct(id, imageUrl) {
    if (!confirm('Delete this product?')) return
    // Delete image from storage too
    if (imageUrl) {
      const fileName = imageUrl.split('/').pop()
      await supabase.storage.from(BUCKET).remove([fileName])
    }
    await supabase.from('products').delete().eq('id', id)
    showToast('Product removed')
    loadAll()
  }

  function startEdit(prod) {
    setForm({ ...prod, price: String(prod.price) })
    setEditing(true)
    setImagePreview(prod.image_url || null)
    setImageFile(null)
    setTab('products')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function updateOrderStatus(order, newStatus) {
    setUpdatingOrder(order.id)
    const { error } = await supabase.from('orders').update({
      status: newStatus, updated_at: new Date().toISOString(),
    }).eq('id', order.id)
    if (error) { showToast('Update failed: ' + error.message); setUpdatingOrder(null); return }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o))
    await sendOrderNotifications({ ...order }, newStatus)
    showToast(`Status → ${newStatus}. Customer notified!`)
    setUpdatingOrder(null)
  }

  if (!user) return null

  const previewSrc = imagePreview || form.image_url

  return (
    <>
      <Head><title>Admin — Green Roots Farm</title></Head>
      <Header user={user} cartCount={0} onCartOpen={() => {}} onAuthOpen={() => {}} notifs={[]} setNotifs={() => {}} />

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...serif, fontSize: 30, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>Farm Manager</div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Manage produce, fulfil orders, and view customers.</div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label:'Products',  value: stats.products,  icon:'🌿' },
            { label:'Orders',    value: stats.orders,    icon:'📦' },
            { label:'Customers', value: stats.customers, icon:'👥' },
            { label:'Revenue',   value: '₹' + stats.revenue.toLocaleString('en-IN'), icon:'💰' },
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
          {['products','orders','customers'].map(t => (
            <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={() => setTab(t)}>
              {t==='products' ? '🌿 Products' : t==='orders' ? '📦 Orders' : '👥 Customers'}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {tab==='products' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:24, alignItems:'start' }}>

            {/* Product list */}
            <div>
              <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>Inventory ({products.length})</div>
              {products.length === 0
                ? <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>
                    <div style={{ fontSize:36, marginBottom:10 }}>🌱</div>
                    <div style={{ fontWeight:600 }}>No products yet — add one →</div>
                  </div>
                : <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                    {products.map(p => (
                      <div key={p.id} className="card" style={{ padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                        {/* Product image thumbnail */}
                        <div style={{ width:52, height:52, borderRadius:10, overflow:'hidden',
                          background:'var(--green-pale)', flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {p.image_url
                            ? <img src={p.image_url} alt={p.name}
                                style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <span style={{ fontSize:26 }}>🌿</span>
                          }
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                            <span style={{ fontWeight:600, fontSize:14 }}>{p.name}</span>
                            {!p.in_stock && <span style={{ fontSize:10, background:'var(--red-pale)',
                              color:'var(--red)', padding:'2px 7px', borderRadius:8, fontWeight:600 }}>
                              Out of stock
                            </span>}
                          </div>
                          <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                            {p.category} · <span style={{ color:'var(--green)', fontWeight:600 }}>₹{p.price}</span>/{p.unit}
                          </div>
                          {p.description && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{p.description}</div>}
                        </div>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={() => startEdit(p)}
                            style={{ padding:'5px 12px', border:'1px solid var(--border)', borderRadius:7,
                              background:'transparent', cursor:'pointer', fontSize:12 }}>Edit</button>
                          <button onClick={() => deleteProduct(p.id, p.image_url)}
                            style={{ padding:'5px 12px', border:'1px solid var(--border)', borderRadius:7,
                              background:'transparent', cursor:'pointer', fontSize:12, color:'var(--red)' }}>Delete</button>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>

            {/* Add / Edit form */}
            <div className="card" style={{ padding:22, position:'sticky', top:80 }}>
              <div style={{ fontWeight:700, fontSize:16, color:'var(--green)', marginBottom:18 }}>
                {editing ? '✏️ Edit Product' : '＋ Add New Product'}
              </div>

              {/* ── Image Upload ── */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:8 }}>
                  Product Photo *
                </div>

                {/* Preview box / drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width:'100%', height:170, borderRadius:12, overflow:'hidden',
                    border:`2px dashed ${previewSrc ? 'var(--green)' : 'var(--border)'}`,
                    background: previewSrc ? 'transparent' : 'var(--green-pale)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    cursor:'pointer', position:'relative', transition:'border .2s',
                  }}>
                  {previewSrc
                    ? <>
                        <img src={previewSrc} alt="preview"
                          style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        {/* Remove button */}
                        <button
                          onClick={e => { e.stopPropagation(); clearImage() }}
                          style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.55)',
                            color:'#fff', border:'none', borderRadius:'50%', width:28, height:28,
                            cursor:'pointer', fontSize:14, display:'flex', alignItems:'center',
                            justifyContent:'center', fontWeight:700 }}>
                          ✕
                        </button>
                      </>
                    : <div style={{ textAlign:'center', color:'var(--muted)' }}>
                        <div style={{ fontSize:32, marginBottom:8 }}>📷</div>
                        <div style={{ fontSize:13, fontWeight:500 }}>Click to upload photo</div>
                        <div style={{ fontSize:11, marginTop:4 }}>JPG, PNG, WebP · Max 5MB</div>
                      </div>
                  }
                </div>

                <input ref={fileRef} type="file" accept="image/*"
                  onChange={onFileChange}
                  style={{ display:'none' }} />

                {uploading && (
                  <div style={{ fontSize:12, color:'var(--green)', marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ display:'inline-block', width:12, height:12, border:'2px solid var(--green)',
                      borderTopColor:'transparent', borderRadius:'50%',
                      animation:'spin 0.8s linear infinite' }} />
                    Uploading image…
                  </div>
                )}
              </div>

              {/* Name + description */}
              {[
                { label:'Product Name *', key:'name',        placeholder:'e.g. Organic Tomatoes' },
                { label:'Description',    key:'description', placeholder:'Short description…', area:true },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:12 }}>
                  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>{f.label}</div>
                  {f.area
                    ? <textarea className="inp" rows={2} value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                    : <input className="inp" value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                  }
                </div>
              ))}

              {/* Price + unit */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                <div>
                  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Price (₹) *</div>
                  <input className="inp" type="number" min="0" step="0.5"
                    value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Unit</div>
                  <select className="inp" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Category */}
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>Category</div>
                <select className="inp" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              {/* In stock toggle */}
              <div style={{ marginBottom:18, display:'flex', alignItems:'center', gap:10 }}>
                <input type="checkbox" id="in_stock" checked={form.in_stock}
                  onChange={e => set('in_stock', e.target.checked)}
                  style={{ width:16, height:16, accentColor:'var(--green)', cursor:'pointer' }} />
                <label htmlFor="in_stock" style={{ fontSize:13, cursor:'pointer' }}>In stock</label>
              </div>

              {/* Buttons */}
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-g" style={{ flex:1, padding:10 }}
                  onClick={saveProduct} disabled={saving || uploading}>
                  {uploading ? 'Uploading…' : saving ? 'Saving…' : editing ? '💾 Update' : '＋ Add Product'}
                </button>
                {editing && (
                  <button className="btn-o" style={{ padding:'10px 14px' }} onClick={resetForm}>
                    Cancel
                  </button>
                )}
              </div>

              <div style={{ marginTop:12, padding:'10px 12px', background:'var(--green-pale)',
                borderRadius:9, fontSize:12, color:'var(--muted)', lineHeight:1.5 }}>
                🔔 Customers get notified automatically on every add/update.
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab==='orders' && (
          <div>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>All Orders ({orders.length})</div>
            {orders.length===0
              ? <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>📦</div>
                  <div style={{ fontWeight:600 }}>No orders yet</div>
                </div>
              : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
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
                            {o.payment_method==='razorpay' ? '💳 Paid Online' : '💵 Cash on Delivery'}
                            {o.payment_status==='paid' && <span style={{ color:'var(--green)', fontWeight:600 }}> ✓</span>}
                          </div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ ...serif, fontSize:20, fontWeight:700, color:'var(--green)', marginBottom:8 }}>
                            ₹{Number(o.total).toFixed(2)}
                          </div>
                          <select value={o.status} disabled={updatingOrder===o.id}
                            onChange={e => updateOrderStatus(o, e.target.value)}
                            style={{ padding:'6px 10px', borderRadius:8, border:'1.5px solid var(--green)',
                              background:'var(--green-pale)', color:'var(--green)', fontWeight:600,
                              fontSize:12, cursor:'pointer', minWidth:160 }}>
                            {ORDER_STATUSES.map(s => <option key={s}>{s}</option>)}
                          </select>
                          {updatingOrder===o.id && (
                            <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>Notifying…</div>
                          )}
                        </div>
                      </div>
                      <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', flexWrap:'wrap', gap:6 }}>
                        {(o.items||[]).map((item,i) => (
                          <span key={i} style={{ fontSize:12, background:'var(--bg)', padding:'3px 10px', borderRadius:12, display:'flex', alignItems:'center', gap:5 }}>
                            {item.image_url
                              ? <img src={item.image_url} alt={item.name}
                                  style={{ width:16, height:16, borderRadius:3, objectFit:'cover' }} />
                              : <span>{item.emoji || '🌿'}</span>
                            }
                            {item.name} × {item.qty} — ₹{(item.price*item.qty).toFixed(0)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}

        {/* ── CUSTOMERS TAB ── */}
        {tab==='customers' && (
          <div>
            <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>Registered Customers ({customers.length})</div>
            {customers.length===0
              ? <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>
                  <div style={{ fontSize:36, marginBottom:10 }}>👥</div>
                  <div style={{ fontWeight:600 }}>No customers yet</div>
                </div>
              : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {customers.map(c => (
                    <div key={c.id} className="card" style={{ padding:'12px 18px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:38, height:38, borderRadius:'50%', background:'var(--green-pale)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        color:'var(--green)', fontWeight:700, fontSize:14, flexShrink:0 }}>
                        {(c.name||c.email||'C').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight:600, fontSize:14 }}>{c.name || '(no name)'}</div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>{c.email}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>
                          {orders.filter(o => o.user_email===c.email).length} order(s)
                        </div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                          Joined {new Date(c.created_at).toLocaleDateString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </div>
        )}
      </main>

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'var(--text)', color:'#fff', padding:'11px 22px',
          borderRadius:12, fontSize:13, zIndex:999,
          whiteSpace:'nowrap', boxShadow:'0 6px 20px rgba(0,0,0,.22)', fontWeight:500 }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </>
  )
}
