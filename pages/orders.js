import { useState, useEffect } from 'react'
import { useRouter }           from 'next/router'
import Head                    from 'next/head'
import { supabase }            from '../lib/supabase'
import Header                  from '../components/Header'
import { Footer, FloatingWhatsApp } from '../components/Footer'
import Pagination              from '../components/Pagination'

const serif    = { fontFamily: 'Playfair Display, serif' }
const PER_PAGE = 5

// ── Star Rating Component ─────────────────────────────────────────────────────
function StarRating({ value, onChange, disabled }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display:'flex', gap:3 }}>
      {[1,2,3,4,5].map(star => (
        <span key={star}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHover(star)}
          onMouseLeave={() => !disabled && setHover(0)}
          style={{
            fontSize: 22, cursor: disabled ? 'default' : 'pointer',
            color: star <= (hover || value) ? '#f5a623' : '#d8cfbc',
            transition: 'color .1s',
          }}>★</span>
      ))}
    </div>
  )
}

// ── Order Rating Section ──────────────────────────────────────────────────────
function OrderRating({ order, user }) {
  const [ratings, setRatings]   = useState({})   // { productId: { delivery, quality } }
  const [saved, setSaved]       = useState({})    // { productId: true }
  const [loading, setLoading]   = useState(false)
  const [existing, setExisting] = useState({})    // existing ratings from DB

  useEffect(() => {
    if (!user || order.status !== 'Delivered') return
    // Fetch existing ratings for this order
    supabase.from('ratings').select('product_id, delivery_rating, quality_rating')
      .eq('order_id', order.id).eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        const ex = {}
        const rv = {}
        data.forEach(r => {
          ex[r.product_id] = true
          rv[r.product_id] = { delivery: r.delivery_rating, quality: r.quality_rating }
        })
        setExisting(ex)
        setRatings(rv)
        setSaved(ex)
      })
  }, [order.id, user])

  if (order.status !== 'Delivered') return null

  async function submitRating(productId) {
    setLoading(productId)
    const { data: { session } } = await supabase.auth.getSession()
    const r = ratings[productId] || {}
    await fetch('/api/ratings', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':`Bearer ${session?.access_token}` },
      body: JSON.stringify({
        order_id: order.id, product_id: productId,
        delivery_rating: r.delivery || null,
        quality_rating:  r.quality  || null,
      }),
    })
    setSaved(prev => ({ ...prev, [productId]: true }))
    setLoading(false)
  }

  function setRating(productId, type, val) {
    setRatings(prev => ({
      ...prev,
      [productId]: { ...(prev[productId]||{}), [type]: val }
    }))
  }

  return (
    <div style={{ borderTop:'1px solid var(--border)', marginTop:14, paddingTop:14 }}>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--muted)', textTransform:'uppercase',
        letterSpacing:1, marginBottom:12 }}>Rate Your Order</div>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {(order.items||[]).map((item, i) => {
          const pid     = item.id || item.product_id || String(i)
          const isSaved = saved[pid]
          const r       = ratings[pid] || {}
          return (
            <div key={pid} style={{ background:'var(--card)', borderRadius:10,
              padding:'12px 14px', border:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                {item.image_url && (
                  <img src={item.image_url} alt=""
                    style={{ width:28, height:28, borderRadius:6, objectFit:'cover' }} />
                )}
                <span style={{ fontWeight:600, fontSize:13 }}>
                  {item.name}{item.selected_option ? ` (${item.selected_option})` : ''}
                </span>
                {isSaved && (
                  <span style={{ fontSize:11, background:'var(--green-pale)', color:'var(--green)',
                    padding:'2px 8px', borderRadius:8, fontWeight:600, marginLeft:'auto' }}>
                    ✓ Rated
                  </span>
                )}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>🚚 Delivery</div>
                  <StarRating value={r.delivery||0} disabled={isSaved}
                    onChange={v => setRating(pid, 'delivery', v)} />
                </div>
                <div>
                  <div style={{ fontSize:11, color:'var(--muted)', marginBottom:4 }}>🌿 Quality</div>
                  <StarRating value={r.quality||0} disabled={isSaved}
                    onChange={v => setRating(pid, 'quality', v)} />
                </div>
              </div>
              {!isSaved && (
                <button onClick={() => submitRating(pid)}
                  disabled={!r.delivery && !r.quality || loading === pid}
                  style={{ fontSize:12, padding:'6px 14px', borderRadius:8, cursor:'pointer',
                    background: (r.delivery||r.quality) ? 'var(--green)' : 'var(--border)',
                    color: (r.delivery||r.quality) ? '#fff' : 'var(--muted)',
                    border:'none', fontWeight:600, transition:'all .15s' }}>
                  {loading === pid ? 'Saving…' : 'Submit Rating'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const STATUS_STEPS = ['Confirmed','Preparing','Out for Delivery','Delivered']
const STATUS_ICONS = {
  Confirmed:'✅', Preparing:'🌿', 'Out for Delivery':'🚚',
  Delivered:'🎉', Cancelled:'❌', 'Payment Pending':'⏳',
}

function StatusBadge({ status }) {
  const colors = {
    'Confirmed':        { bg:'var(--green-pale)',  text:'var(--green)' },
    'Preparing':        { bg:'var(--green-pale)',  text:'var(--green)' },
    'Out for Delivery': { bg:'var(--gold-pale)',   text:'var(--gold)'  },
    'Delivered':        { bg:'var(--green-pale)',  text:'var(--green)' },
    'Cancelled':        { bg:'var(--red-pale)',    text:'var(--red)'   },
    'Payment Pending':  { bg:'var(--gold-pale)',   text:'var(--gold)'  },
  }
  const c = colors[status] || colors.Confirmed
  return (
    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12,
      background:c.bg, color:c.text, display:'inline-block' }}>
      {STATUS_ICONS[status]} {status}
    </span>
  )
}

export default function OrdersPage() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [notifs, setNotifs]     = useState([])

  const [filterProduct,  setFilterProduct]  = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo,   setFilterDateTo]   = useState('')
  const [filterStatus,   setFilterStatus]   = useState('All')
  const [page, setPage] = useState(1)
  const [farms, setFarms]           = useState([])
  const [filterFarm, setFilterFarm] = useState('All')
 useEffect(() => { setPage(1) }, [filterProduct, filterDateFrom, filterDateTo, filterStatus, filterFarm])

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      if (!session?.user) { router.replace('/'); return }
      setUser(session.user)
      fetchOrders(session.user.id)
      fetch('/api/admin/farms?active=true')
  .then(r => r.json()).then(d => setFarms(d || [])).catch(() => {})
    })
    const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) router.replace('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('orders_' + user.id)
      .on('postgres_changes', {
        event:'UPDATE', schema:'public', table:'orders',
        filter:`user_id=eq.${user.id}`,
      }, payload => {
        setOrders(prev => prev.map(o => o.id===payload.new.id ? {...o,...payload.new} : o))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  async function fetchOrders(userId) {
    setLoading(true)
    const { data } = await supabase.from('orders')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending:false })
    setOrders(data||[])
    setLoading(false)
  }

  const allProductNames = [...new Set(
    orders.flatMap(o => (o.items||[]).map(i => i.name))
  )].sort()

  const filtered = orders.filter(o => {
  if (filterProduct && !(o.items||[]).some(i => i.name===filterProduct)) return false
  if (filterDateFrom && new Date(o.created_at) < new Date(filterDateFrom)) return false
  if (filterDateTo) {
    const end = new Date(filterDateTo); end.setHours(23,59,59,999)
    if (new Date(o.created_at) > end) return false
  }
  if (filterStatus !== 'All' && o.status !== filterStatus) return false
  if (filterFarm !== 'All' && o.farm_id !== filterFarm) return false  // ← add this
  return true
})

  const hasFilters = filterProduct || filterDateFrom || filterDateTo || filterStatus !== 'All' || filterFarm !== 'All'
  const pagedOrders = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)
  const stepIndex   = (status) => STATUS_STEPS.indexOf(status)

  function clearFilters() {
  setFilterProduct(''); setFilterDateFrom(''); setFilterDateTo('')
  setFilterStatus('All'); setFilterFarm('All'); setPage(1)
}

  return (
    <>
      <Head><title>My Orders — Adarshini Organic Farm</title></Head>
      <Header user={user} cartCount={0} onCartOpen={()=>{}} onAuthOpen={()=>{}}
        notifs={notifs} setNotifs={setNotifs} />

      <main style={{ maxWidth:800, margin:'0 auto', padding:'32px 20px' }}>

        <div style={{ marginBottom:24 }}>
          <div style={{ ...serif, fontSize:30, fontWeight:700, color:'var(--green)' }}>My Orders</div>
          <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>
            Track your fresh produce deliveries.
          </div>
        </div>

        {/* Filter bar */}
        {orders.length > 0 && (
          <div className="card" style={{ padding:'16px 18px', marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontWeight:600, fontSize:14 }}>🔍 Filter Orders</div>
              {hasFilters && (
                <button onClick={clearFilters}
                  style={{ fontSize:12, color:'var(--red)', background:'var(--red-pale)', border:'none',
                    borderRadius:8, padding:'4px 12px', cursor:'pointer', fontWeight:500 }}>
                  Clear filters
                </button>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:`repeat(${farms.length > 1 ? 5 : 4}, 1fr)`, gap:10 }}>
              <div>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginBottom:4,
                  textTransform:'uppercase', letterSpacing:0.5 }}>Product</div>
                <select className="inp" style={{ padding:'7px 10px', fontSize:13 }}
                  value={filterProduct} onChange={e=>{ setFilterProduct(e.target.value); setPage(1) }}>
                  <option value="">All products</option>
                  {allProductNames.map(n=><option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginBottom:4,
                  textTransform:'uppercase', letterSpacing:0.5 }}>From date</div>
                <input className="inp" type="date" style={{ padding:'7px 10px', fontSize:13 }}
                  value={filterDateFrom} onChange={e=>{ setFilterDateFrom(e.target.value); setPage(1) }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginBottom:4,
                  textTransform:'uppercase', letterSpacing:0.5 }}>To date</div>
                <input className="inp" type="date" style={{ padding:'7px 10px', fontSize:13 }}
                  value={filterDateTo} onChange={e=>{ setFilterDateTo(e.target.value); setPage(1) }} />
              </div>
              <div>
                <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginBottom:4,
                  textTransform:'uppercase', letterSpacing:0.5 }}>Status</div>
                <select className="inp" style={{ padding:'7px 10px', fontSize:13 }}
                  value={filterStatus} onChange={e=>{ setFilterStatus(e.target.value); setPage(1) }}>
                  <option value="All">All statuses</option>
                  {['Confirmed','Preparing','Out for Delivery','Delivered','Cancelled','Payment Pending'].map(s=>(
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
                  {farms.length > 1 && (
                <div>
                  <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, marginBottom:4,
                    textTransform:'uppercase', letterSpacing:0.5 }}>Farm</div>
                  <select className="inp" style={{ padding:'7px 10px', fontSize:13 }}
                    value={filterFarm} onChange={e => { setFilterFarm(e.target.value); setPage(1) }}>
                    <option value="All">All farms</option>
                    {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
            </div>
          </div>
        )}

        {hasFilters && (
          <div style={{ fontSize:13, color:'var(--muted)', marginBottom:14 }}>
            Showing <strong style={{ color:'var(--text)' }}>{filtered.length}</strong> of {orders.length} orders
            {filterProduct && <> containing <strong style={{ color:'var(--green)' }}>{filterProduct}</strong></>}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--muted)' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🌱</div>Loading your orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="card" style={{ padding:'60px 20px', textAlign:'center', color:'var(--muted)' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🧺</div>
            <div style={{ fontWeight:600, fontSize:16, marginBottom:6 }}>No orders yet</div>
            <div style={{ fontSize:13, marginBottom:20 }}>Start shopping!</div>
            <button className="btn-g" onClick={()=>router.push('/')}>Browse Produce</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding:'48px 20px', textAlign:'center', color:'var(--muted)' }}>
            <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
            <div style={{ fontWeight:600, marginBottom:8 }}>No orders match your filters</div>
            <button onClick={clearFilters} className="btn-o" style={{ padding:'7px 18px', fontSize:13 }}>
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {pagedOrders.map(order => {
              const isExpanded  = expanded === order.id
              const isCancelled = order.status === 'Cancelled'
              const isPending   = order.status === 'Payment Pending'
              const si          = stepIndex(order.status)

              return (
                <div key={order.id} className="card" style={{ overflow:'hidden' }}>

                  {/* Order header — click to expand */}
                  <div style={{ padding:'16px 20px', display:'flex', alignItems:'center',
                    justifyContent:'space-between', cursor:'pointer', userSelect:'none' }}
                    onClick={() => setExpanded(isExpanded ? null : order.id)}>
                    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--green-pale)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {STATUS_ICONS[order.status] || '📦'}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:14 }}>
                          Order #{order.id.slice(0,8).toUpperCase()}
                        </div>
                        <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day:'numeric', month:'short', year:'numeric'
                          })}
                          &nbsp;·&nbsp;{order.items?.length||0} item{order.items?.length!==1?'s':''}
                          &nbsp;·&nbsp;{order.payment_method==='razorpay'
  ? order.payment_status==='paid' ? '💳 Paid' : '⏳ Pending'
  : '💵 COD'}
                        </div>
                        <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                          {(order.items||[]).map(i =>
                            i.name+(i.selected_option?` (${i.selected_option})`:'')
                          ).join(', ')}
                        </div>
                          {/* Add farm name below */}
{order.farm_id && farms.find(f => f.id === order.farm_id) && (
  <div style={{ fontSize:11, color:'var(--green)', fontWeight:500, marginTop:2 }}>
    🚜 {farms.find(f => f.id === order.farm_id)?.name}
  </div>
)}
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ ...serif, fontSize:18, fontWeight:700, color:'var(--green)' }}>
                        ₹{Number(order.total).toFixed(2)}
                      </div>
                      <div style={{ marginTop:4 }}>
                        <StatusBadge status={order.status} />
                      </div>
                      <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
                        {isExpanded ? '▲ Hide details' : '▼ View details'}
                      </div>
                    </div>
                  </div>

                  {/* Progress tracker */}
                  {!isCancelled && !isPending && (
                    <div style={{ padding:'0 20px 16px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', position:'relative' }}>
                        {STATUS_STEPS.map((step, idx) => {
                          const done   = si >= idx
                          const active = si === idx
                          return (
                            <div key={step} style={{ flex:1, display:'flex', flexDirection:'column',
                              alignItems:'center', position:'relative' }}>
                              {idx > 0 && (
                                <div style={{ position:'absolute', top:14, right:'50%', left:'-50%',
                                  height:3, background: si>=idx ? 'var(--green)' : 'var(--border)',
                                  transition:'background .4s' }} />
                              )}
                              <div style={{ width:28, height:28, borderRadius:'50%', zIndex:1,
                                background: done ? 'var(--green)' : 'var(--border)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:13, color:'#fff',
                                boxShadow: active ? '0 0 0 4px var(--green-pale)' : 'none',
                                transition:'all .4s' }}>
                                {done ? '✓' : idx+1}
                              </div>
                              <div style={{ fontSize:10, marginTop:6, textAlign:'center',
                                color: done ? 'var(--green)' : 'var(--muted)',
                                fontWeight: active ? 600 : 400, lineHeight:1.3 }}>
                                {step}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Cancelled */}
                  {isCancelled && (
                    <div style={{ padding:'0 20px 16px' }}>
                      <div style={{ background:'var(--red-pale)', color:'var(--red)',
                        padding:'12px 14px', borderRadius:9, fontSize:13, lineHeight:1.6 }}>
                        ❌ This order was cancelled.
                        {order.cancel_reason && (
                          <div style={{ marginTop:6, fontWeight:600 }}>
                            Reason: <span style={{ fontWeight:400 }}>{order.cancel_reason}</span>
                          </div>
                        )}
                        <div style={{ marginTop:6, fontSize:12, opacity:0.8 }}>
                          Contact us if you have any questions.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Payment pending */}
                  {isPending && (
                    <div style={{ padding:'0 20px 16px' }}>
                      <div style={{ background:'var(--gold-pale)', color:'var(--gold)',
                        padding:'10px 14px', borderRadius:9, fontSize:13 }}>
                        ⏳ Payment is being processed. Your order will be confirmed once payment is received.
                      </div>
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ borderTop:'1px solid var(--border)', padding:'16px 20px', background:'var(--bg)' }}>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

                        {/* Delivery address */}
                        <div>
                          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600,
                            textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                            Delivery Address
                          </div>
                          <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.7 }}>
                            <div style={{ fontWeight:600 }}>{order.customer_name}</div>
                            <div>{order.address}</div>
                            <div>📞 {order.phone}</div>
                            {order.notes && (
                              <div style={{ marginTop:6, fontSize:12, fontStyle:'italic',
                                color:'var(--muted)', background:'var(--card)',
                                padding:'6px 10px', borderRadius:7, border:'1px solid var(--border)' }}>
                                📝 {order.notes}
                              </div>
                            )}
                          </div>
                        </div>
                         
                        {/* Items ordered */}
                        <div>
                          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600,
                            textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                            Items Ordered
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                            {(order.items||[]).map((item,i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between',
                                alignItems:'center', fontSize:13, gap:8 }}>
                                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                  {item.image_url && (
                                    <img src={item.image_url} alt=""
                                      style={{ width:20, height:20, borderRadius:4, objectFit:'cover' }} />
                                  )}
                                  <span>
                                    {item.name}
                                    {item.selected_option ? ` (${item.selected_option})` : ''}
                                    {' '}× {item.qty}
                                  </span>
                                </div>
                                <span style={{ color:'var(--green)', fontWeight:600, flexShrink:0 }}>
                                  ₹{((item.effective_price??item.price)*item.qty).toFixed(0)}
                                </span>
                              </div>
                            ))}
                            <div style={{ borderTop:'1px solid var(--border)', marginTop:4, paddingTop:6,
                              display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:13 }}>
                              <span>Total</span>
                              <span style={{ color:'var(--green)' }}>₹{Number(order.total).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                      </div>
 {order.farm_id && farms.find(f => f.id === order.farm_id) && (
                            <div style={{ marginTop:14, padding:'10px 14px', background:'var(--green-pale)',
                              borderRadius:9, fontSize:13 }}>
                              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600,
                                textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Farm Source</div>
                              <div style={{ fontWeight:600, color:'var(--green)' }}>
                                🚜 {farms.find(f => f.id === order.farm_id)?.name}
                              </div>
                            </div>
                          )}
                      {/* Invoice button — outside grid, after both columns */}
                      <div style={{ borderTop:'1px solid var(--border)', marginTop:16,
                        paddingTop:14, textAlign:'right' }}>
                        <a href={`/invoice?id=${order.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize:13, color:'var(--green)', textDecoration:'none', fontWeight:600,
                            padding:'7px 16px', border:'1.5px solid var(--green)', borderRadius:8,
                            display:'inline-flex', alignItems:'center', gap:6 }}>
                          📄 Download Invoice
                        </a>
                      </div>

                      {/* Rating section — only for delivered orders */}
                      <OrderRating order={order} user={user} />

                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        <Pagination page={page} total={filtered.length} perPage={PER_PAGE}
          onChange={p => { setPage(p); window.scrollTo({ top:0, behavior:'smooth' }) }} />

      </main>

      <Footer />
      <FloatingWhatsApp message="Hi! I have a question about my order." />
    </>
  )
}
