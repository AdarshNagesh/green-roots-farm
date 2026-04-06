import { useState, useEffect } from 'react'
import { useRouter }           from 'next/router'
import Head                    from 'next/head'
import { supabase, isAdmin }   from '../lib/supabase'
import Header                  from '../components/Header'

const serif = { fontFamily: 'Playfair Display, serif' }
const CATEGORIES = ['Vegetables', 'Fruits', 'Herbs', 'Grains', 'Dairy', 'Others']
const UNITS      = ['kg', 'g', 'piece', 'bunch', 'dozen', 'litre', 'pack', 'box']
const EMOJIS     = ['🥕','🥦','🍅','🌽','🥬','🫑','🍆','🧅','🧄','🥜','🌾','🍎','🍊','🍋','🥝','🫐','🍇','🥑','🌿','🫚','🥛','🧀','🥚','🍯','🌶️','🥒','🌰','🫘']

const BLANK = { id: '', name: '', price: '', unit: 'kg', category: 'Vegetables', description: '', emoji: '🥕', in_stock: true }

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [products, setProducts] = useState([])
  const [orders, setOrders]     = useState([])
  const [customers, setCustomers] = useState([])
  const [tab, setTab]           = useState('products')
  const [form, setForm]         = useState(BLANK)
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [toast, setToast]       = useState('')
  const [stats, setStats]       = useState({ products: 0, orders: 0, customers: 0, revenue: 0 })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      if (!u || !isAdmin(u)) { router.replace('/'); return }
      setUser(u)
      loadAll()
    })
  }, [])

  async function loadAll() {
    const [p, o, c] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false }),
    ])
    const prods = p.data || []
    const ords  = o.data || []
    const custs = c.data || []
    setProducts(prods); setOrders(ords); setCustomers(custs)
    setStats({
      products: prods.length,
      orders:   ords.length,
      customers: custs.length,
      revenue:  ords.reduce((s, o) => s + Number(o.total), 0),
    })
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 3200) }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function saveProduct() {
    if (!form.name || !form.price) { showToast('Name and price are required'); return }
    setSaving(true)
    const payload = { ...form, price: parseFloat(form.price) }
    delete payload.id

    let error
    if (editing) {
      ({ error } = await supabase.from('products').update(payload).eq('id', form.id))
    } else {
      ({ error } = await supabase.from('products').insert(payload))
    }
    setSaving(false)
    if (error) { showToast('Error: ' + error.message); return }
    showToast(editing ? '✅ Product updated! Customers notified.' : '✅ Product added! Customers notified.')
    setForm(BLANK); setEditing(false)
    loadAll()
  }

  async function deleteProduct(id) {
    if (!confirm('Delete this product?')) return
    await supabase.from('products').delete().eq('id', id)
    showToast('Product removed')
    loadAll()
  }

  function startEdit(prod) {
    setForm({ ...prod, price: String(prod.price) })
    setEditing(true)
    setTab('products')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function updateOrderStatus(id, status) {
    await supabase.from('orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
    showToast('Order status updated')
  }

  if (!user) return null

  return (
    <>
      <Head><title>Admin Panel — Green Roots Farm</title></Head>
      <Header user={user} cartCount={0} onCartOpen={() => {}} onAuthOpen={() => {}} notifCount={0} onNotifOpen={() => {}} />

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px' }}>
        {/* Title + Stats */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...serif, fontSize: 30, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>
            Farm Manager
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>
            Manage your produce, view orders, and see your customers.
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {[
            { label: 'Products', value: stats.products, icon: '🌿' },
            { label: 'Orders',   value: stats.orders,   icon: '📦' },
            { label: 'Customers',value: stats.customers, icon: '👥' },
            { label: 'Revenue',  value: '₹' + stats.revenue.toLocaleString('en-IN'), icon: '💰' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 26 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
          {['products', 'orders', 'customers'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
              {t === 'products' ? '🌿 Products' : t === 'orders' ? '📦 Orders' : '👥 Customers'}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {tab === 'products' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'start' }}>
            {/* List */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
                Inventory ({products.length} items)
              </div>
              {products.length === 0 ? (
                <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🌱</div>
                  <div style={{ fontWeight: 600 }}>No products yet</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Add your first item using the form →</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {products.map(p => (
                    <div key={p.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 30 }}>{p.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>{p.name}</span>
                          {!p.in_stock && (
                            <span className="pill" style={{ background: 'var(--red-pale)', color: 'var(--red)' }}>Out of stock</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {p.category} · <span style={{ color: 'var(--green)', fontWeight: 600 }}>₹{p.price}</span>/{p.unit}
                        </div>
                        {p.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => startEdit(p)}
                          style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 12 }}>
                          Edit
                        </button>
                        <button onClick={() => deleteProduct(p.id)}
                          style={{ padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'transparent', cursor: 'pointer', fontSize: 12, color: 'var(--red)' }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add/Edit Form */}
            <div className="card" style={{ padding: 22, position: 'sticky', top: 80 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--green)', marginBottom: 18 }}>
                {editing ? '✏️ Edit Product' : '＋ Add New Product'}
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 7 }}>Choose Emoji</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {EMOJIS.map(e => (
                    <button key={e} className={`emoji-btn ${form.emoji === e ? 'selected' : ''}`}
                      onClick={() => set('emoji', e)}>{e}</button>
                  ))}
                </div>
              </div>

              {[
                { label: 'Product Name *', key: 'name', placeholder: 'e.g. Organic Tomatoes' },
                { label: 'Description',   key: 'description', placeholder: 'Short description for customers…', textarea: true },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>{f.label}</div>
                  {f.textarea
                    ? <textarea className="inp" rows={2} value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                    : <input className="inp" value={form[f.key]}
                        onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
                  }
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Price (₹) *</div>
                  <input className="inp" type="number" min="0" step="0.5"
                    value={form.price} onChange={e => set('price', e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Unit</div>
                  <select className="inp" value={form.unit} onChange={e => set('unit', e.target.value)}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Category</div>
                <select className="inp" value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="in_stock" checked={form.in_stock}
                  onChange={e => set('in_stock', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--green)' }} />
                <label htmlFor="in_stock" style={{ fontSize: 13, color: 'var(--text)', cursor: 'pointer' }}>
                  In stock (visible to customers)
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-g" style={{ flex: 1, padding: 10 }} onClick={saveProduct} disabled={saving}>
                  {saving ? 'Saving…' : editing ? '💾 Update' : '＋ Add Product'}
                </button>
                {editing && (
                  <button className="btn-o" style={{ padding: '10px 14px' }}
                    onClick={() => { setForm(BLANK); setEditing(false) }}>Cancel</button>
                )}
              </div>

              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--green-pale)', borderRadius: 9, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                🔔 All registered customers get notified automatically when you add or update a product.
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab === 'orders' && (
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>All Orders ({orders.length})</div>
            {orders.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📦</div>
                <div style={{ fontWeight: 600 }}>No orders yet</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {orders.map(o => (
                  <div key={o.id} className="card" style={{ padding: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{o.customer_name || o.user_email}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          #{o.id.slice(0, 8)} · {new Date(o.created_at).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>📍 {o.address}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>📞 {o.phone}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ ...serif, fontSize: 20, fontWeight: 700, color: 'var(--green)' }}>
                          ₹{Number(o.total).toFixed(2)}
                        </div>
                        <select value={o.status}
                          onChange={e => updateOrderStatus(o.id, e.target.value)}
                          style={{ marginTop: 6, padding: '4px 8px', borderRadius: 8, border: '1px solid var(--border)',
                            background: 'var(--green-pale)', color: 'var(--green)', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                          {['Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'].map(s => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(o.items || []).map((item, i) => (
                        <span key={i} style={{ fontSize: 12, background: 'var(--bg)', padding: '3px 10px', borderRadius: 12 }}>
                          {item.emoji} {item.name} × {item.qty} — ₹{(item.price * item.qty).toFixed(0)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CUSTOMERS TAB ── */}
        {tab === 'customers' && (
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>
              Registered Customers ({customers.length})
            </div>
            {customers.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
                <div style={{ fontWeight: 600 }}>No customers yet</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Share your website to get customers to sign up!</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {customers.map(c => (
                  <div key={c.id} className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--green-pale)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--green)', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {(c.name || c.email || 'C').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.email}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Joined {new Date(c.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>
                      {orders.filter(o => o.user_email === c.email).length} order(s)
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text)', color: '#fff', padding: '11px 22px',
          borderRadius: 12, fontSize: 13, zIndex: 999,
          whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(0,0,0,.22)', fontWeight: 500 }}>
          {toast}
        </div>
      )}
    </>
  )
}
