import { useState, useEffect } from 'react'
import Head                    from 'next/head'
import { supabase, isAdmin }   from '../lib/supabase'
import Header                  from '../components/Header'
import AuthModal               from '../components/AuthModal'
import CartSidebar             from '../components/CartSidebar'
import { Footer, FloatingWhatsApp } from '../components/Footer'

const serif      = { fontFamily: 'Playfair Display, serif' }
const CATEGORIES = ['Vegetables','Fruits','Herbs','Grains','Dairy','Others']
const LOW_STOCK  = 5


// ── Notify Me Button ──────────────────────────────────────────────────────────
function NotifyMeButton({ productId, userId, userEmail }) {
  const [onList, setOnList]   = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/waitlist?user_id=${userId}&product_id=${productId}`)
      .then(r => r.json())
      .then(d => setOnList(d.on_waitlist))
      .catch(() => {})
  }, [])

  async function toggle() {
    setLoading(true)
    const method = onList ? 'DELETE' : 'POST'
    await fetch('/api/waitlist', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, user_email: userEmail, product_id: productId }),
    })
    setOnList(!onList)
    setLoading(false)
  }

  return (
    <button onClick={toggle} disabled={loading}
      style={{ padding:'7px 12px', fontSize:11, fontWeight:600, borderRadius:8, cursor:'pointer',
        border:`1.5px solid ${onList ? 'var(--green)' : 'var(--border)'}`,
        background: onList ? 'var(--green-pale)' : 'transparent',
        color: onList ? 'var(--green)' : 'var(--muted)',
        fontFamily:'DM Sans, sans-serif' }}>
      {loading ? '…' : onList ? '🔔 Notifying' : '🔔 Notify Me'}
    </button>
  )
}

// ── Product Detail Modal ──────────────────────────────────────────────────────
function ProductModal({ product, onClose, onAddToCart, user, onAuthOpen }) {
  const opts = product.quantity_options || []
  const [selectedIdx, setSelectedIdx] = useState(0)

  const selectedOpt  = opts[selectedIdx] || null
  const displayPrice = selectedOpt ? product.price * selectedOpt.multiplier : product.price
  const displayLabel = selectedOpt ? selectedOpt.label : `1 ${product.unit}`

  const hasStock     = product.stock_quantity !== null && product.stock_quantity !== undefined
  const stockCount   = product.stock_quantity
  const isLow        = hasStock && stockCount > 0 && stockCount <= LOW_STOCK
  const isOutOfStock = !product.in_stock || (hasStock && stockCount === 0)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleAdd() {
    if (isOutOfStock) return
    onAddToCart(product, selectedOpt)
    onClose()
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}
      style={{ alignItems:'center', padding:20 }}>
      <div style={{ background:'var(--card)', borderRadius:20, width:'100%', maxWidth:560,
        maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column',
        boxShadow:'0 24px 64px rgba(0,0,0,0.22)' }}>

        {/* Image */}
        <div style={{ position:'relative', height:260, background:'var(--green-pale)', flexShrink:0 }}>
          {product.image_url
            ? <img src={product.image_url} alt={product.name}
                style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:80 }}>🌿</div>
          }
          <button onClick={onClose}
            style={{ position:'absolute', top:12, right:12, width:36, height:36, borderRadius:'50%',
              background:'rgba(0,0,0,0.55)', color:'#fff', border:'none', cursor:'pointer',
              fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
            ✕
          </button>
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:6 }}>
            <span className="pill" style={{ background:'rgba(255,255,255,0.92)', color:'var(--gold)',
              boxShadow:'0 1px 6px rgba(0,0,0,0.12)' }}>{product.category}</span>
            {isLow && !isOutOfStock && (
              <span className="pill" style={{ background:'rgba(184,125,18,0.9)', color:'#fff', fontSize:10 }}>
                Only {stockCount} left!
              </span>
            )}
            {isOutOfStock && (
              <span className="pill" style={{ background:'rgba(184,50,50,0.9)', color:'#fff', fontSize:10 }}>
                Out of Stock
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding:'24px 28px 28px', overflowY:'auto', flex:1 }}>
          <div style={{ ...serif, fontSize:24, fontWeight:700, marginBottom:6 }}>{product.name}</div>

          <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:16 }}>
            <span style={{ ...serif, fontSize:28, fontWeight:700, color:'var(--green)' }}>
              ₹{displayPrice % 1 === 0 ? displayPrice.toFixed(0) : displayPrice.toFixed(2)}
            </span>
            <span style={{ fontSize:13, color:'var(--muted)' }}>
              {opts.length > 0 ? `/ ${displayLabel}` : `/ ${product.unit}`}
            </span>
          </div>

          {product.description && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase',
                letterSpacing:1, marginBottom:8 }}>About this product</div>
              <div style={{ fontSize:14, color:'var(--text)', lineHeight:1.8 }}>{product.description}</div>
            </div>
          )}

          {hasStock && !isOutOfStock && (
            <div style={{ marginBottom:16, padding:'10px 14px', background:'var(--green-pale)',
              borderRadius:10, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--green)',
                display:'inline-block', flexShrink:0 }} />
              <span style={{ fontSize:13, color:'var(--green)', fontWeight:500 }}>
                {isLow ? `Only ${stockCount} ${product.unit} remaining — order soon!` : `${stockCount} ${product.unit} available`}
              </span>
            </div>
          )}

          {opts.length > 0 && (
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase',
                letterSpacing:1, marginBottom:10 }}>Select quantity</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {opts.map((opt, i) => (
                  <button key={i} onClick={() => setSelectedIdx(i)}
                    style={{ padding:'8px 18px', borderRadius:24, cursor:'pointer', fontSize:13, fontWeight:500,
                      border:`2px solid ${selectedIdx===i ? 'var(--green)' : 'var(--border)'}`,
                      background: selectedIdx===i ? 'var(--green)' : 'transparent',
                      color: selectedIdx===i ? '#fff' : 'var(--text)', transition:'all .15s' }}>
                    {opt.label}
                    <span style={{ fontSize:11, opacity:0.8, marginLeft:5 }}>
                      ₹{(product.price*opt.multiplier)%1===0
                        ? (product.price*opt.multiplier).toFixed(0)
                        : (product.price*opt.multiplier).toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Add to cart or Notify Me */}
          {isOutOfStock ? (
            user
              ? <NotifyMeButton productId={product.id} userId={user.id} userEmail={user.email} />
              : <button className="btn-o" style={{ width:'100%', padding:'13px', fontSize:15, borderRadius:12 }}
                  onClick={() => { onClose(); onAuthOpen() }}>
                  🔔 Sign in to get notified
                </button>
          ) : (
            <button className="btn-g" style={{ width:'100%', padding:'13px', fontSize:16, borderRadius:12 }}
              onClick={handleAdd}>
              Add to Cart — ₹{displayPrice%1===0?displayPrice.toFixed(0):displayPrice.toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Product Card ──────────────────────────────────────────────────────────────
function ProductCard({ product, user, onAddToCart, onViewDetail, onAuthOpen }) {
  const opts        = product.quantity_options || []
  const [selectedIdx, setSelectedIdx] = useState(0)

  const selectedOpt  = opts[selectedIdx] || null
  const displayPrice = selectedOpt ? product.price * selectedOpt.multiplier : product.price
  const displayLabel = selectedOpt ? selectedOpt.label : `1 ${product.unit}`

  const hasStock     = product.stock_quantity !== null && product.stock_quantity !== undefined
  const stockCount   = product.stock_quantity
  const isLow        = hasStock && stockCount > 0 && stockCount <= LOW_STOCK
  const isOutOfStock = !product.in_stock || (hasStock && stockCount === 0)

  const LIMIT       = 60
  const descLong    = product.description && product.description.length > LIMIT
  const descPreview = descLong ? product.description.slice(0, LIMIT).trimEnd() + '…' : product.description

  function handleAdd(e) {
    e.stopPropagation()
    if (isOutOfStock) return
    onAddToCart(product, selectedOpt)
  }

  return (
    <div className="prod-card">
      {/* Image */}
      <div style={{ position:'relative', height:180, background:'var(--green-pale)', overflow:'hidden', cursor:'pointer' }}
        onClick={() => onViewDetail(product)}>
        {product.image_url
          ? <img src={product.image_url} alt={product.name}
              style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .35s' }}
              onMouseEnter={e => e.target.style.transform='scale(1.06)'}
              onMouseLeave={e => e.target.style.transform='scale(1)'} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:64 }}>🌿</div>
        }
        {isOutOfStock && (
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <span style={{ color:'#fff', fontWeight:700, fontSize:14,
              background:'rgba(0,0,0,0.6)', padding:'6px 14px', borderRadius:20 }}>Out of Stock</span>
          </div>
        )}
        <div style={{ position:'absolute', top:10, left:10 }}>
          <span className="pill" style={{ background:'rgba(255,255,255,0.92)', color:'var(--gold)',
            boxShadow:'0 1px 6px rgba(0,0,0,0.12)' }}>{product.category}</span>
        </div>
        {isLow && !isOutOfStock && (
          <div style={{ position:'absolute', top:10, right:10 }}>
            <span className="pill" style={{ background:'rgba(184,125,18,0.9)', color:'#fff', fontSize:10 }}>
              Only {stockCount} left!
            </span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div style={{ padding:'14px 16px 16px' }}>
        <div style={{ fontWeight:600, fontSize:15, marginBottom:4, cursor:'pointer' }}
          onClick={() => onViewDetail(product)}>
          {product.name}
        </div>

        {product.description && (
          <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, marginBottom:8 }}>
            {descPreview}
            {descLong && (
              <button onClick={() => onViewDetail(product)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--green)',
                  fontSize:12, fontWeight:600, padding:0, marginLeft:3 }}>
                Read more
              </button>
            )}
          </div>
        )}

        {hasStock && !isLow && !isOutOfStock && (
          <div style={{ fontSize:11, color:'var(--green)', fontWeight:500, marginBottom:8,
            display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)', display:'inline-block' }} />
            {stockCount} {product.unit} available
          </div>
        )}

        {opts.length > 0 && (
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginBottom:6,
              textTransform:'uppercase', letterSpacing:0.5 }}>Select quantity</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
              {opts.map((opt, i) => (
                <button key={i} onClick={e => { e.stopPropagation(); setSelectedIdx(i) }}
                  style={{ padding:'5px 11px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500,
                    border:`1.5px solid ${selectedIdx===i ? 'var(--green)' : 'var(--border)'}`,
                    background: selectedIdx===i ? 'var(--green)' : 'transparent',
                    color: selectedIdx===i ? '#fff' : 'var(--text)', transition:'all .15s' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price + button */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop: opts.length>0 ? 4 : 8 }}>
          <div>
            <span style={{ ...serif, fontSize:20, fontWeight:700, color:'var(--green)' }}>
              ₹{displayPrice % 1 === 0 ? displayPrice.toFixed(0) : displayPrice.toFixed(2)}
            </span>
            <span style={{ fontSize:11, color:'var(--muted)' }}>
              {opts.length > 0 ? ` / ${displayLabel}` : ` / ${product.unit}`}
            </span>
          </div>

          {isOutOfStock ? (
            user
              ? <NotifyMeButton productId={product.id} userId={user.id} userEmail={user.email} />
              : <button className="btn-o" style={{ padding:'7px 12px', fontSize:11 }}
                  onClick={onAuthOpen}>🔔 Notify Me</button>
          ) : (
            <button className="btn-g" style={{ padding:'7px 15px', fontSize:12 }}
              onClick={handleAdd}>+ Add</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Shop Page ────────────────────────────────────────────────────────────
export default function ShopPage() {
  const [user, setUser]                 = useState(null)
  const [products, setProducts]         = useState([])
  const [cart, setCart]                 = useState([])
  const [notifs, setNotifs]             = useState([])
  const [filter, setFilter]             = useState('All')
  const [search, setSearch]             = useState('')
  const [showAuth, setShowAuth]         = useState(false)
  const [showCart, setShowCart]         = useState(false)
  const [modalProduct, setModalProduct] = useState(null)
  const [toast, setToast]               = useState('')
  const [loading, setLoading]           = useState(true)
  const [farms, setFarms]       = useState([])
const [farmFilter, setFarmFilter] = useState('All')

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => setUser(session?.user??null))
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user??null))
    fetchProducts()
    fetch('/api/admin/farms?active=true').then(r=>r.json()).then(d=>setFarms(d||[])).catch(()=>{})
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || isAdmin(user)) return
    fetchNotifs(user.id)
    const ch = supabase.channel('notifs_'+user.id)
      .on('postgres_changes', { event:'INSERT', schema:'public', table:'notifications', filter:`user_id=eq.${user.id}` },
        payload => {
          setNotifs(prev => [payload.new, ...prev])
          toast_show(payload.new.type==='order' ? '📦 Order update!' : '🌿 New farm update!')
        })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user])

  useEffect(() => {
    const prodChannel = supabase.channel('products_live')
      .on('postgres_changes', { event:'*', schema:'public', table:'products' }, fetchProducts)
      .subscribe()
    const orderChannel = supabase.channel('orders_stock_watch')
      .on('postgres_changes', { event:'UPDATE', schema:'public', table:'orders' }, fetchProducts)
      .subscribe()
    return () => {
      supabase.removeChannel(prodChannel)
      supabase.removeChannel(orderChannel)
    }
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending:false })
    setProducts(data||[]); setLoading(false)
  }

  async function fetchNotifs(userId) {
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', userId).order('created_at', { ascending:false }).limit(50)
    setNotifs(data||[])
  }

  function addToCart(prod, selectedOpt) {
    if (!user) { setShowAuth(true); return }
    const effectivePrice = selectedOpt ? prod.price * selectedOpt.multiplier : prod.price
    const optionLabel    = selectedOpt ? selectedOpt.label : null
    const multiplier     = selectedOpt ? selectedOpt.multiplier : 1
    const cartKey        = prod.id + (optionLabel ? '_' + optionLabel : '')

    setCart(prev => {
      const ex = prev.find(i => i.cartKey === cartKey)
      if (prod.stock_quantity !== null && prod.stock_quantity !== undefined) {
        const allCartUnits = prev.filter(i => i.id === prod.id)
          .reduce((s, i) => s + (i.qty * (i.multiplier||1)), 0)
        if (allCartUnits + multiplier > prod.stock_quantity) {
          toast_show(`Only ${prod.stock_quantity} ${prod.unit} available — can't add more`)
          return prev
        }
      }
      if (ex) return prev.map(i => i.cartKey === cartKey ? { ...i, qty: i.qty+1 } : i)
      return [...prev, {
        ...prod, cartKey,
        effective_price: parseFloat(effectivePrice.toFixed(2)),
        selected_option: optionLabel,
        multiplier,
        qty: 1,
      }]
    })
    toast_show(prod.name + (optionLabel ? ` (${optionLabel})` : '') + ' added to cart')
  }

  function updateQty(cartKey, qty) {
    if (qty < 1) { setCart(prev => prev.filter(i => i.cartKey !== cartKey)); return }
    setCart(prev => {
      const item = prev.find(i => i.cartKey === cartKey)
      if (!item) return prev
      if (qty > item.qty && item.stock_quantity !== null && item.stock_quantity !== undefined) {
        const allCartUnits = prev.filter(i => i.id === item.id)
          .reduce((s, i) => s + (i.cartKey === cartKey ? qty*(i.multiplier||1) : i.qty*(i.multiplier||1)), 0)
        if (allCartUnits > item.stock_quantity) {
          toast_show(`Only ${item.stock_quantity} ${item.unit} available`)
          return prev
        }
      }
      return prev.map(i => i.cartKey === cartKey ? { ...i, qty } : i)
    })
  }

  function toast_show(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const cartCount = cart.reduce((s,i) => s+i.qty, 0)
 const activeFarmIds = new Set(farms.map(f => f.id))
const filtered = products.filter(p=>
  (p.farm_id === null || activeFarmIds.has(p.farm_id)) &&
  (filter==='All'||p.category===filter) &&
  (farmFilter==='All'||p.farm_id===farmFilter) &&
  p.name.toLowerCase().includes(search.toLowerCase())
)

  return (
    <>
      <Head>
        <title>Adarshini Organic Farm — Fresh Produce</title>
        <meta name="description" content="Fresh organic produce from Adarshini farm — direct to your table." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Header user={user} cartCount={cartCount} onCartOpen={() => setShowCart(true)}
        onAuthOpen={() => setShowAuth(true)} notifs={notifs} setNotifs={setNotifs} />

      <main style={{ maxWidth:1120, margin:'0 auto', padding:'28px 20px' }}>

        {/* Hero */}
        <div style={{ background:'linear-gradient(130deg, var(--green) 0%, var(--green-l) 100%)',
          borderRadius:22, padding:'40px 48px', marginBottom:28, color:'#fff',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          overflow:'hidden', position:'relative' }}>
          <div style={{ position:'absolute', right:40, top:-20, fontSize:160, opacity:0.1 }}>🌾</div>
          <div style={{ position:'relative', maxWidth:480 }}>
            <div style={{ fontSize:11, letterSpacing:3, textTransform:'uppercase', opacity:0.75, marginBottom:8 }}>
              100% Natural · No Chemicals · No Middlemen
            </div>
            <div style={{ ...serif, fontSize:36, fontWeight:700, lineHeight:1.2, marginBottom:12 }}>
              Adarshini Farm,<br />Fresh to You
            </div>
            <div style={{ opacity:0.85, fontSize:15, lineHeight:1.6, marginBottom:20 }}>
              Organically grown produce harvested at peak ripeness — from our soil to your table.
            </div>
            {!user && (
              <button className="btn-g" onClick={() => setShowAuth(true)}
                style={{ background:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.5)', padding:'10px 22px' }}>
                Register for Updates 🔔
              </button>
            )}
          </div>
          <div style={{ fontSize:88, flexShrink:0 }}>🧺</div>
        </div>
{farms.length > 1 && (
  <div style={{display:'flex',gap:6,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
    <span style={{fontSize:12,color:'var(--muted)',fontWeight:600,marginRight:4}}>Farm:</span>
    {['All',...farms.map(f=>({id:f.id,name:f.name}))].map(f=>(
      <button key={typeof f==='string'?f:f.id}
        onClick={()=>setFarmFilter(typeof f==='string'?'All':f.id)}
        style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:500,
          border:`1.5px solid ${farmFilter===(typeof f==='string'?'All':f.id)?'var(--green)':'var(--border)'}`,
          background:farmFilter===(typeof f==='string'?'All':f.id)?'var(--green)':'transparent',
          color:farmFilter===(typeof f==='string'?'All':f.id)?'#fff':'var(--text)',transition:'all .2s'}}>
        {typeof f==='string'?'🌿 All Farms':f.name}
      </button>
    ))}
  </div>
)}
        {/* Search + filters */}
        <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:'1 1 200px' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'var(--muted)' }}>🔍</span>
            <input className="inp" style={{ paddingLeft:34 }} placeholder="Search produce…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['All',...CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilter(cat)}
                style={{ padding:'6px 14px', borderRadius:20, cursor:'pointer', fontSize:12, fontWeight:500,
                  border:`1.5px solid ${filter===cat ? 'var(--green)' : 'var(--border)'}`,
                  background: filter===cat ? 'var(--green)' : 'transparent',
                  color: filter===cat ? '#fff' : 'var(--text)', transition:'all .2s' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products grid */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--muted)' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🌱</div>Loading fresh produce…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--muted)' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>{products.length===0 ? '🌱' : '🔍'}</div>
            <div style={{ fontSize:16, fontWeight:600, marginBottom:6 }}>
              {products.length===0 ? 'No products yet' : 'No matching products'}
            </div>
            <div style={{ fontSize:13 }}>
              {products.length===0 ? 'Check back soon!' : 'Try a different search or category'}
            </div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))', gap:18 }}>
            {filtered.map(p => (
              <ProductCard key={p.id} product={p}
                user={user}
                onAddToCart={addToCart}
                onViewDetail={setModalProduct}
                onAuthOpen={() => setShowAuth(true)} />
            ))}
          </div>
        )}
      </main>

      <Footer />
      <FloatingWhatsApp />

      {modalProduct && (
        <ProductModal
          product={modalProduct}
          user={user}
          onClose={() => setModalProduct(null)}
          onAddToCart={(prod, opt) => addToCart(prod, opt)}
          onAuthOpen={() => setShowAuth(true)} />
      )}

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showCart && (
        <CartSidebar cart={cart} user={user}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          onClearCart={() => setCart([])} />
      )}

      {toast && (
        <div style={{ position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
          background:'var(--text)', color:'#fff', padding:'11px 22px',
          borderRadius:12, fontSize:13, zIndex:999,
          whiteSpace:'nowrap', boxShadow:'0 6px 20px rgba(0,0,0,.22)', fontWeight:500 }}>
          {toast}
        </div>
      )}
    </>
  )
}
