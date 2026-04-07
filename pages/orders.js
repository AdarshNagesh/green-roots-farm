import { useState, useEffect } from 'react'
import { useRouter }           from 'next/router'
import Head                    from 'next/head'
import { supabase }            from '../lib/supabase'
import Header                  from '../components/Header'
import { Footer, FloatingWhatsApp } from '../components/Footer'

const serif = { fontFamily: 'Playfair Display, serif' }

const STATUS_STEPS = ['Confirmed','Preparing','Out for Delivery','Delivered']
const STATUS_ICONS = { Confirmed:'✅', Preparing:'🌿', 'Out for Delivery':'🚚', Delivered:'🎉', Cancelled:'❌', 'Payment Pending':'⏳' }

export default function OrdersPage() {
  const router = useRouter()
  const [user, setUser]     = useState(null)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) { router.replace('/'); return }
      setUser(session.user)
      fetchOrders(session.user.id)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) router.replace('/')
    })
    return () => subscription.unsubscribe()
  }, [])

  // Realtime order status updates
  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('orders_' + user.id)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `user_id=eq.${user.id}`,
      }, payload => {
        setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o))
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  async function fetchOrders(userId) {
    setLoading(true)
    const { data } = await supabase.from('orders')
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const stepIndex = (status) => STATUS_STEPS.indexOf(status)

  return (
    <>
      <Head><title>My Orders — Green Roots Farm</title></Head>
      <Header user={user} cartCount={0} onCartOpen={() => {}} onAuthOpen={() => {}} notifCount={0} onNotifOpen={() => {}} />

      <main style={{ maxWidth:760, margin:'0 auto', padding:'32px 20px' }}>
        <div style={{ marginBottom:28 }}>
          <div style={{ ...serif, fontSize:30, fontWeight:700, color:'var(--green)' }}>My Orders</div>
          <div style={{ fontSize:13, color:'var(--muted)', marginTop:4 }}>
            Track your fresh produce deliveries in real time.
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 20px', color:'var(--muted)' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🌱</div>Loading your orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="card" style={{ padding:'60px 20px', textAlign:'center', color:'var(--muted)' }}>
            <div style={{ fontSize:52, marginBottom:12 }}>🧺</div>
            <div style={{ fontWeight:600, fontSize:16, marginBottom:6 }}>No orders yet</div>
            <div style={{ fontSize:13, marginBottom:20 }}>You haven't placed any orders. Start shopping!</div>
            <button className="btn-g" onClick={() => router.push('/')}>Browse Produce</button>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {orders.map(order => {
              const isExpanded = expanded === order.id
              const isCancelled = order.status === 'Cancelled'
              const isPending   = order.status === 'Payment Pending'
              const si          = stepIndex(order.status)

              return (
                <div key={order.id} className="card" style={{ overflow:'hidden' }}>
                  {/* Order header */}
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
                          {new Date(order.created_at).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
                          &nbsp;·&nbsp;
                          {order.items?.length || 0} item{order.items?.length !== 1 ? 's' : ''}
                          &nbsp;·&nbsp;
                          {order.payment_method === 'razorpay' ? '💳 Paid Online' : '💵 COD'}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <div style={{ ...serif, fontSize:18, fontWeight:700, color:'var(--green)' }}>
                        ₹{Number(order.total).toFixed(2)}
                      </div>
                      <div style={{ marginTop:4 }}>
                        <StatusBadge status={order.status} />
                      </div>
                    </div>
                  </div>

                  {/* Progress tracker */}
                  {!isCancelled && !isPending && (
                    <div style={{ padding:'0 20px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', position:'relative' }}>
                        {STATUS_STEPS.map((step, idx) => {
                          const done   = si >= idx
                          const active = si === idx
                          return (
                            <div key={step} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative' }}>
                              {/* Connector line */}
                              {idx > 0 && (
                                <div style={{
                                  position:'absolute', top:14, right:'50%', left:'-50%',
                                  height:3, background: si >= idx ? 'var(--green)' : 'var(--border)',
                                  transition:'background .4s',
                                }} />
                              )}
                              {/* Dot */}
                              <div style={{
                                width:28, height:28, borderRadius:'50%', zIndex:1,
                                background: done ? 'var(--green)' : 'var(--border)',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                fontSize:13, color:'#fff',
                                boxShadow: active ? '0 0 0 4px var(--green-pale)' : 'none',
                                transition:'all .4s',
                              }}>
                                {done ? '✓' : idx + 1}
                              </div>
                              <div style={{ fontSize:10, marginTop:6, textAlign:'center',
                                color: done ? 'var(--green)' : 'var(--muted)', fontWeight: active ? 600 : 400,
                                lineHeight:1.3 }}>
                                {step}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {isCancelled && (
                    <div style={{ padding:'0 20px 16px' }}>
                      <div style={{ background:'var(--red-pale)', color:'var(--red)', padding:'10px 14px',
                        borderRadius:9, fontSize:13 }}>
                        ❌ This order was cancelled. Please contact us if you have any questions.
                      </div>
                    </div>
                  )}

                  {isPending && (
                    <div style={{ padding:'0 20px 16px' }}>
                      <div style={{ background:'var(--gold-pale)', color:'var(--gold)', padding:'10px 14px',
                        borderRadius:9, fontSize:13 }}>
                        ⏳ Payment is being processed. Your order will be confirmed once payment is received.
                      </div>
                    </div>
                  )}

                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{ borderTop:'1px solid var(--border)', padding:'16px 20px', background:'var(--bg)' }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                        <div>
                          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                            Delivery Address
                          </div>
                          <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6 }}>
                            <div style={{ fontWeight:600 }}>{order.customer_name}</div>
                            <div>{order.address}</div>
                            <div>📞 {order.phone}</div>
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                            Items Ordered
                          </div>
                          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                            {(order.items || []).map((item, i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
                                <span>{item.emoji} {item.name} × {item.qty}</span>
                                <span style={{ color:'var(--green)', fontWeight:600 }}>₹{(item.price*item.qty).toFixed(0)}</span>
                              </div>
                            ))}
                            <div style={{ borderTop:'1px solid var(--border)', marginTop:6, paddingTop:6,
                              display:'flex', justifyContent:'space-between', fontWeight:700, fontSize:13 }}>
                              <span>Total</span>
                              <span style={{ color:'var(--green)' }}>₹{Number(order.total).toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
      <FloatingWhatsApp message="Hi! I have a question about my order." />
    </>
  )
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
