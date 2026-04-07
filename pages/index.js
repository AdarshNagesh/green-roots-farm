import { useState, useEffect } from 'react'
import Head                    from 'next/head'
import { supabase, isAdmin }   from '../lib/supabase'
import Header                  from '../components/Header'
import AuthModal               from '../components/AuthModal'
import CartSidebar             from '../components/CartSidebar'

const serif     = { fontFamily: 'Playfair Display, serif' }
const CATEGORIES = ['Vegetables','Fruits','Herbs','Grains','Dairy','Others']

export default function ShopPage() {
  const [user, setUser]         = useState(null)
  const [products, setProducts] = useState([])
  const [cart, setCart]         = useState([])
  const [notifs, setNotifs]     = useState([])
  const [filter, setFilter]     = useState('All')
  const [search, setSearch]     = useState('')
  const [showAuth, setShowAuth] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [toast, setToast]       = useState('')
  const [loading, setLoading]   = useState(true)

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    fetchProducts()
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || isAdmin(user)) return
    fetchNotifs(user.id)

    const ch = supabase.channel('notifs_' + user.id)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setNotifs(prev => [payload.new, ...prev])
        toast_show(payload.new.type === 'order' ? '📦 Order update!' : '🌿 New farm update!')
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user])

  useEffect(() => {
    const ch = supabase.channel('products_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  async function fetchProducts() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setProducts(data || [])
    setLoading(false)
  }

  async function fetchNotifs(userId) {
    const { data } = await supabase.from('notifications')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false }).limit(50)
    setNotifs(data || [])
  }

  // ── Cart ──────────────────────────────────────────────────────────────────
  function addToCart(prod) {
    if (!user) { setShowAuth(true); return }
    setCart(prev => {
      const ex = prev.find(i => i.id === prod.id)
      if (ex) return prev.map(i => i.id === prod.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...prod, qty: 1 }]
    })
    toast_show((prod.image_url ? '' : '🌿 ') + prod.name + ' added to cart')
  }

  function updateQty(id, qty) {
    if (qty < 1) setCart(prev => prev.filter(i => i.id !== id))
    else         setCart(prev => prev.map(i => i.id === id ? { ...i, qty } : i))
  }

  function toast_show(msg) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const cartCount = cart.reduce((s, i) => s + i.qty, 0)
  const filtered  = products.filter(p =>
    (filter === 'All' || p.category === filter) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Head>
        <title>Green Roots Farm — Fresh Organic Produce</title>
        <meta name="description" content="Farm fresh organic produce direct from our fields to your table." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Header
        user={user}
        cartCount={cartCount}
        onCartOpen={() => setShowCart(true)}
        onAuthOpen={() => setShowAuth(true)}
        notifs={notifs}
        setNotifs={setNotifs}
      />

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '28px 20px' }}>

        {/* Hero */}
        <div style={{
          background: 'linear-gradient(130deg, var(--green) 0%, var(--green-l) 100%)',
          borderRadius: 22, padding: '40px 48px', marginBottom: 28,
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', overflow: 'hidden', position: 'relative',
        }}>
          <div style={{ position:'absolute', right:40, top:-20, fontSize:160, opacity:0.1 }}>🌾</div>
          <div style={{ position:'relative', maxWidth:480 }}>
            <div style={{ fontSize:11, letterSpacing:3, textTransform:'uppercase', opacity:0.75, marginBottom:8 }}>
              100% Natural · No Chemicals · No Middlemen
            </div>
            <div style={{ ...serif, fontSize:36, fontWeight:700, lineHeight:1.2, marginBottom:12 }}>
              Farm Fresh,<br />Direct to You
            </div>
            <div style={{ opacity:0.85, fontSize:15, lineHeight:1.6, marginBottom:20 }}>
              Organically grown produce harvested at peak ripeness — from our soil to your table.
            </div>
            {!user && (
              <button className="btn-g"
                style={{ background:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.5)', padding:'10px 22px' }}
                onClick={() => setShowAuth(true)}>
                Register for Updates 🔔
              </button>
            )}
          </div>
          <div style={{ fontSize:88, flexShrink:0 }}>🧺</div>
        </div>

        {/* Search + filters */}
        <div style={{ display:'flex', gap:12, marginBottom:24, flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ position:'relative', flex:'1 1 200px' }}>
            <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:14, color:'var(--muted)' }}>🔍</span>
            <input className="inp" style={{ paddingLeft:34 }} placeholder="Search produce…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {['All', ...CATEGORIES].map(cat => (
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
            <div style={{ fontSize:36, marginBottom:12 }}>🌱</div>
            Loading fresh produce…
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
              <div key={p.id} className="prod-card">

                {/* Product image */}
                <div style={{ position:'relative', height:180, background:'var(--green-pale)', overflow:'hidden' }}>
                  {p.image_url
                    ? <img
                        src={p.image_url}
                        alt={p.name}
                        style={{ width:'100%', height:'100%', objectFit:'cover',
                          transition:'transform .35s' }}
                        onMouseEnter={e => e.target.style.transform='scale(1.06)'}
                        onMouseLeave={e => e.target.style.transform='scale(1)'}
                      />
                    : <div style={{ width:'100%', height:'100%', display:'flex',
                        alignItems:'center', justifyContent:'center', fontSize:64 }}>
                        🌿
                      </div>
                  }
                  {!p.in_stock && (
                    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.45)',
                      display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ color:'#fff', fontWeight:700, fontSize:14,
                        background:'rgba(0,0,0,0.6)', padding:'6px 14px', borderRadius:20 }}>
                        Out of Stock
                      </span>
                    </div>
                  )}
                  {/* Category pill on image */}
                  <div style={{ position:'absolute', top:10, left:10 }}>
                    <span className="pill" style={{ background:'rgba(255,255,255,0.92)', color:'var(--gold)',
                      boxShadow:'0 1px 6px rgba(0,0,0,0.12)' }}>
                      {p.category}
                    </span>
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding:'14px 16px 16px' }}>
                  <div style={{ fontWeight:600, fontSize:15, marginBottom:4 }}>{p.name}</div>
                  {p.description && (
                    <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, marginBottom:8,
                      display:'-webkit-box', WebkitLineClamp:2,
                      WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                      {p.description}
                    </div>
                  )}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:10 }}>
                    <div>
                      <span style={{ ...serif, fontSize:20, fontWeight:700, color:'var(--green)' }}>₹{p.price}</span>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>/{p.unit}</span>
                    </div>
                    <button className="btn-g" style={{ padding:'7px 15px', fontSize:12 }}
                      disabled={!p.in_stock} onClick={() => addToCart(p)}>
                      + Add
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showCart && (
        <CartSidebar
          cart={cart} user={user}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          onClearCart={() => setCart([])}
        />
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
