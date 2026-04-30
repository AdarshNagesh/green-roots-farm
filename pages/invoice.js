import { useState, useEffect } from 'react'
import { useRouter }           from 'next/router'
import Head                    from 'next/head'
import { supabase }            from '../lib/supabase'

const serif = { fontFamily: 'Playfair Display, serif' }

export default function InvoicePage() {
  const router = useRouter()
  const { id }  = router.query
  const [order, setOrder]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')
  const [farm, setFarm] = useState(null)

  useEffect(() => {
    if (!id) return
    supabase.auth.getSession().then(async ({ data:{ session } }) => {
      if (!session?.user) { router.replace('/'); return }
      const { data, error: err } = await supabase.from('orders')
        .select('*').eq('id', id).eq('user_id', session.user.id).single()
      if (err || !data) { setError('Order not found'); setLoading(false); return }
      setOrder(data); setLoading(false)
      if (data.farm_id) {
        const { data: farmData } = await supabase.from('farms')
          .select('name, address, phone, email').eq('id', data.farm_id).single()
        if (farmData) setFarm(farmData)
      }
    })
  }, [id])

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Arial,sans-serif', color:'#687165' }}>
      Loading invoice…
    </div>
  )

  if (error || !order) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'Arial,sans-serif', color:'#b83232' }}>
      {error || 'Order not found'}
    </div>
  )

  const orderDate = new Date(order.created_at).toLocaleDateString('en-IN', {
    day:'numeric', month:'long', year:'numeric'
  })

  return (
    <>
      <Head>
        <title>Invoice #{order.id.slice(0,8).toUpperCase()} — Adarshini Organic Farm</title>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { background: white !important; }
          }
          body { margin:0; background:#f5f0e6; font-family: Arial, sans-serif; }
        `}</style>
      </Head>

      {/* Print / Download button */}
      <div className="no-print" style={{ background:'#2d6a27', padding:'12px 24px',
        display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ color:'#fff', fontSize:14, fontWeight:600 }}>🌿 Adarshini Organic Farm — Invoice</div>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => window.print()}
            style={{ background:'#fff', color:'#2d6a27', border:'none', borderRadius:8,
              padding:'8px 18px', cursor:'pointer', fontWeight:600, fontSize:13 }}>
            🖨️ Print / Save PDF
          </button>
          <button onClick={() => router.back()}
            style={{ background:'transparent', color:'#fff', border:'1px solid rgba(255,255,255,0.5)',
              borderRadius:8, padding:'8px 18px', cursor:'pointer', fontSize:13 }}>
            ← Back
          </button>
        </div>
      </div>

      {/* Invoice */}
      <div style={{ maxWidth:680, margin:'32px auto', background:'#fff', borderRadius:16,
        overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.1)', padding:'40px 48px' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:36 }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
              <span style={{ fontSize:32 }}>🌿</span>
              <div>
                <div style={{ ...serif, fontSize:22, fontWeight:700, color:'#2d6a27' }}>Adarshini</div>
                <div style={{ fontSize:10, color:'#687165', letterSpacing:2, textTransform:'uppercase' }}>Organic Farm</div>
              </div>
            </div>
            {process.env.NEXT_PUBLIC_CONTACT_PHONE && (
              <div style={{ fontSize:12, color:'#687165' }}>📞 {process.env.NEXT_PUBLIC_CONTACT_PHONE}</div>
            )}
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL && (
              <div style={{ fontSize:12, color:'#687165' }}>✉️ {process.env.NEXT_PUBLIC_CONTACT_EMAIL}</div>
            )}
            <div style={{ fontSize:12, color:'#687165' }}>🌐 adarshini.co.in</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:11, color:'#687165', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Invoice</div>
            <div style={{ ...serif, fontSize:20, fontWeight:700, color:'#1e2d1c' }}>
              #{order.id.slice(0,8).toUpperCase()}
            </div>
            <div style={{ fontSize:13, color:'#687165', marginTop:4 }}>{orderDate}</div>
            <div style={{ marginTop:8 }}>
              <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:12,
                background: order.status==='Delivered' ? '#e8f3e6' : '#fef3d8',
                color: order.status==='Delivered' ? '#2d6a27' : '#b87d12' }}>
                {order.status}
              </span>
            </div>
          </div>
        </div>

        <div style={{ height:1, background:'#d8cfbc', marginBottom:28 }} />

        {/* Bill To */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:28, marginBottom:28 }}>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#687165', textTransform:'uppercase',
              letterSpacing:1, marginBottom:8 }}>Bill To</div>
            <div style={{ fontWeight:600, fontSize:15, color:'#1e2d1c', marginBottom:4 }}>{order.customer_name}</div>
            <div style={{ fontSize:13, color:'#687165', lineHeight:1.7 }}>
              {order.address}<br/>
              📞 {order.phone}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'#687165', textTransform:'uppercase',
              letterSpacing:1, marginBottom:8 }}>Payment</div>
            <div style={{ fontSize:13, color:'#1e2d1c', lineHeight:1.7 }}>
              <div>{order.payment_method==='razorpay' ? '💳 Paid Online' : '💵 Cash on Delivery'}</div>
              {order.payment_status==='paid' && <div style={{ color:'#2d6a27', fontWeight:600 }}>✓ Payment Confirmed</div>}
              {order.razorpay_payment_id && <div style={{ fontSize:11, color:'#687165' }}>Ref: {order.razorpay_payment_id}</div>}
            </div>
            {order.notes && (
              <div style={{ marginTop:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#687165', textTransform:'uppercase', letterSpacing:1, marginBottom:4 }}>Note</div>
                <div style={{ fontSize:13, color:'#687165', fontStyle:'italic' }}>{order.notes}</div>
              </div>
            )}
          </div>
        </div>
          {farm && (
          <div style={{ marginTop:16, marginBottom:20, padding:'12px 14px', background:'#f5f0e6',
            borderRadius:9 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#687165', textTransform:'uppercase',
                letterSpacing:1, marginBottom:6 }}>Fulfilled By</div>
              <div style={{ fontWeight:600, fontSize:14, color:'#1e2d1c', marginBottom:2 }}>
                🚜 {farm.name}
              </div>
              {farm.address && <div style={{ fontSize:12, color:'#687165' }}>📍 {farm.address}</div>}
            </div>
          )}
        {/* Items table */}
        <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:24 }}>
          <thead>
            <tr style={{ background:'#f5f0e6' }}>
              <th style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:700,
                color:'#687165', textTransform:'uppercase', letterSpacing:0.5 }}>Item</th>
              <th style={{ padding:'10px 14px', textAlign:'left', fontSize:12, fontWeight:700,
                color:'#687165', textTransform:'uppercase', letterSpacing:0.5 }}>Farm</th>
              <th style={{ padding:'10px 14px', textAlign:'center', fontSize:12, fontWeight:700,
                color:'#687165', textTransform:'uppercase', letterSpacing:0.5 }}>Qty</th>
              <th style={{ padding:'10px 14px', textAlign:'right', fontSize:12, fontWeight:700,
                color:'#687165', textTransform:'uppercase', letterSpacing:0.5 }}>Rate</th>
              <th style={{ padding:'10px 14px', textAlign:'right', fontSize:12, fontWeight:700,
                color:'#687165', textTransform:'uppercase', letterSpacing:0.5 }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {(order.items || []).map((item, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #e8e0d0' }}>
                <td style={{ padding:'12px 14px', fontSize:14, color:'#1e2d1c' }}>
                  <div style={{ fontWeight:500 }}>{item.name}</div>
                  {item.selected_option && <div style={{ fontSize:12, color:'#687165' }}>{item.selected_option}</div>}
                </td>
                <td style={{ padding:'12px 14px', fontSize:12, color:'#687165' }}>
                  {farm?.name || '—'}
                </td>
                <td style={{ padding:'12px 14px', textAlign:'center', fontSize:14, color:'#1e2d1c' }}>
                  {item.qty} {item.unit}
                </td>
                <td style={{ padding:'12px 14px', textAlign:'right', fontSize:14, color:'#1e2d1c' }}>
                  ₹{(item.effective_price ?? item.price).toFixed(2)}
                </td>
                <td style={{ padding:'12px 14px', textAlign:'right', fontSize:14, fontWeight:600, color:'#1e2d1c' }}>
                  ₹{((item.effective_price ?? item.price) * item.qty).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background:'#f5f0e6' }}>
              <td colSpan="4" style={{ padding:'14px', textAlign:'right', fontWeight:700, fontSize:16 }}>
                Total
              </td>
              <td style={{ padding:'14px', textAlign:'right', fontWeight:700, fontSize:20, color:'#2d6a27' }}>
                ₹{Number(order.total).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Footer */}
        <div style={{ height:1, background:'#d8cfbc', marginBottom:20 }} />
        <div style={{ textAlign:'center', fontSize:12, color:'#687165', lineHeight:1.8 }}>
          Thank you for ordering from Adarshini Organic Farm 🌿<br/>
          Fresh from our farm, straight to your table.<br/>
          <strong>adarshini.co.in</strong>
        </div>
      </div>
    </>
  )
}
