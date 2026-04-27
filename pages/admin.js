import { useState, useEffect, useRef } from 'react'
import { useRouter }                   from 'next/router'
import Head                            from 'next/head'
import { supabase, isAdmin }           from '../lib/supabase'
import { sendOrderNotifications }      from '../lib/notifications'
import Header                          from '../components/Header'
import Pagination                      from '../components/Pagination'
import { notifyCustomersOfProduct }    from '../lib/productNotify'

const serif = { fontFamily: 'Playfair Display, serif' }
const CATEGORIES     = ['Vegetables','Fruits','Herbs','Grains','Dairy','Others']
const UNITS          = ['kg','g','piece','bunch','dozen','litre','pack','box']
const BUCKET         = 'product-images'
const ORDER_STATUSES = ['Confirmed','Preparing','Out for Delivery','Delivered','Cancelled']
const BLANK = { id:'', name:'', price:'', unit:'kg', category:'Vegetables', description:'', image_url:'', in_stock:true, is_visible:true, quantity_options:[], stock_quantity:'', min_order_value:'',points_per_unit:'0',notifyCustomers: true,farm_id:'' }
const LOW_STOCK      = 5
const PER_PAGE       = { products:10, orders:8, customers:10 }


const PRESETS = {
  'kg options':    [{ label:'250g', multiplier:0.25 },{ label:'500g', multiplier:0.5 },{ label:'1 kg', multiplier:1 },{ label:'2 kg', multiplier:2 }],
  'litre options': [{ label:'250 ml', multiplier:0.25 },{ label:'500 ml', multiplier:0.5 },{ label:'1 litre', multiplier:1 }],
  'dozen options': [{ label:'½ dozen (6)', multiplier:0.5 },{ label:'1 dozen (12)', multiplier:1 },{ label:'2 dozen (24)', multiplier:2 }],
  'piece options': [{ label:'1 piece', multiplier:1 },{ label:'2 pieces', multiplier:2 },{ label:'5 pieces', multiplier:5 }],
  'bunch options': [{ label:'Small bunch', multiplier:0.5 },{ label:'1 bunch', multiplier:1 },{ label:'2 bunches', multiplier:2 }],
}

export default function AdminPage() {
  const router  = useRouter()
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
const [settings, setSettings]   = useState({ points_to_rupee_rate:'1', referral_reward_points:'20' })
const [settingsSaved, setSettingsSaved] = useState(false)
  const [fCustomer,  setFCustomer]  = useState('')
  const [fProduct,   setFProduct]   = useState('')
  const [fDateFrom,  setFDateFrom]  = useState('')
  const [fDateTo,    setFDateTo]    = useState('')
  const [fStatus,    setFStatus]    = useState('All')
  const [farms, setFarms] = useState([])
const [fFarm, setFFarm] = useState('All')
  const [cancelModal, setCancelModal]   = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const [prodPage, setProdPage]   = useState(1)
  const [orderPage, setOrderPage] = useState(1)
  const [custPage, setCustPage]   = useState(1)

  useEffect(() => {
    supabase.auth.getSession().then(({ data:{ session } }) => {
      const u = session?.user ?? null
      if (!u || !isAdmin(u)) { router.replace('/'); return }
      setUser(u); loadAll()
    })
  }, [])

  async function loadAll() {
    const [p, o] = await Promise.all([
      supabase.from('products').select('*').order('created_at', { ascending:false }),
      supabase.from('orders').select('*').order('created_at', { ascending:false }),
    ])
    setProducts(p.data||[]); setOrders(o.data||[])
    setStats({ products:(p.data||[]).length, orders:(o.data||[]).length,
      revenue:(o.data||[]).reduce((s,o)=>s+Number(o.total),0), customers:0 })
    loadCustomers()
    loadSettings()
    loadFarms()
  }

  async function loadFarms() {
  const res = await fetch('/api/admin/farms')
  if (res.ok) setFarms(await res.json())
}

  async function loadSettings() {
  const res = await fetch('/api/settings')
  if (res.ok) {
    const data = await res.json()
    const map = Object.fromEntries(data.map(s => [s.key, s.value]))
    setSettings(s => ({ ...s, ...map }))
  }
}

async function saveSettings() {
  await Promise.all(Object.entries(settings).map(([key, value]) =>
    fetch('/api/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
  ))
  setSettingsSaved(true)
  setTimeout(() => setSettingsSaved(false), 2500)
}

  async function loadCustomers() {
    const res = await fetch('/api/admin/customers')
    if (res.ok) { const d=await res.json(); setCustomers(d); setStats(s=>({...s,customers:d.length})) }
  }

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(''),3500) }
  function set(k,v) { setForm(f=>({...f,[k]:v})) }

  function onFileChange(e) {
    const file=e.target.files[0]; if(!file) return
    if(!file.type.startsWith('image/')) { showToast('Please select an image file'); return }
    if(file.size>5*1024*1024) { showToast('Image must be under 5MB'); return }
    setImageFile(file); setImagePreview(URL.createObjectURL(file))
  }
  function clearImage() {
    setImageFile(null); setImagePreview(null); set('image_url','')
    if(fileRef.current) fileRef.current.value=''
  }
  async function uploadImage(file) {
    const ext=file.name.split('.').pop(), fileName=`product_${Date.now()}.${ext}`
    const { error }=await supabase.storage.from(BUCKET).upload(fileName, file, { contentType:file.type })
    if(error) throw error
    return supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl
  }

  function addOption() { set('quantity_options',[...(form.quantity_options||[]),{ label:'',multiplier:1 }]) }
  function updateOption(idx,field,val) {
    const opts=[...(form.quantity_options||[])]
    opts[idx]={...opts[idx],[field]:field==='multiplier'?parseFloat(val)||0:val}
    set('quantity_options',opts)
  }
  function removeOption(idx) { set('quantity_options',(form.quantity_options||[]).filter((_,i)=>i!==idx)) }
  function applyPreset(key) { set('quantity_options',PRESETS[key]) }

  async function saveProduct() {
    if(!form.name||!form.price) { showToast('Name and price are required'); return }
    if(!form.image_url&&!imageFile) { showToast('Please upload a product photo'); return }
    setSaving(true)
    try {
      let imageUrl=form.image_url
      if(imageFile) { setUploading(true); imageUrl=await uploadImage(imageFile); setUploading(false) }
      const qty_opts=(form.quantity_options||[]).filter(o=>o.label&&o.multiplier>0)
      const stockQty=form.stock_quantity===''||form.stock_quantity===null ? null : parseFloat(form.stock_quantity)
      const payload={
        name:form.name, description:form.description, price:parseFloat(form.price),
        unit:form.unit, category:form.category, image_url:imageUrl, in_stock:form.in_stock,
        is_visible: form.is_visible !== false,
        quantity_options:qty_opts.length>0?qty_opts:null, stock_quantity:stockQty,min_order_value: form.min_order_value==='' ? null : parseFloat(form.min_order_value),points_per_unit: parseInt(form.points_per_unit) || 0,farm_id: form.farm_id || null,
      }
      const { error }=editing
        ? await supabase.from('products').update(payload).eq('id',form.id)
        : await supabase.from('products').insert(payload)
      if(error) throw error
      showToast(editing?'✅ Updated — customers notified!':'✅ Added — customers notified!')
      if (!editing || form.notifyCustomers) {
      await notifyCustomersOfProduct(
        { ...payload, min_order_value: form.min_order_value==='' ? null : parseFloat(form.min_order_value),emoji: form.emoji || '🌿', name: form.name },
        !editing
      )
      }
      resetForm(); loadAll()
    } catch(e) { showToast('Error: '+e.message) }
    finally { setSaving(false); setUploading(false) }
  }

  function resetForm() {
    setForm(BLANK); setEditing(false); setImageFile(null); setImagePreview(null)
    if(fileRef.current) fileRef.current.value=''
  }

  async function deleteProduct(id,imageUrl) {
    if(!confirm('Delete this product?')) return
    if(imageUrl) await supabase.storage.from(BUCKET).remove([imageUrl.split('/').pop()])
    await supabase.from('products').delete().eq('id',id)
    showToast('Product removed'); loadAll()
  }

  function startEdit(prod) {
    setForm({...prod, price:String(prod.price), quantity_options:prod.quantity_options||[], stock_quantity:prod.stock_quantity??'', is_visible: prod.is_visible !== false,min_order_value: prod.min_order_value ?? '',farm_id: prod.farm_id || '',points_per_unit: prod.points_per_unit || 0,notifyCustomers: true})
    setEditing(true); setImagePreview(prod.image_url||null); setImageFile(null); setTab('products')
    window.scrollTo({top:0,behavior:'smooth'})
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
      status: newStatus, cancel_reason: reason || null, updated_at: new Date().toISOString(),
    }).eq('id', order.id)
    if (error) { showToast('Failed: ' + error.message); setUpdatingOrder(null); return }
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus, cancel_reason: reason } : o))
    await sendOrderNotifications({ ...order, cancel_reason: reason }, newStatus)
    showToast(`Status → ${newStatus}. Customer notified!`)
    setUpdatingOrder(null)
    if (newStatus === 'Confirmed') loadAll()
  }

  const allOrderProducts = [...new Set(orders.flatMap(o=>(o.items||[]).map(i=>i.name)))].sort()
  const allCustomers     = [...new Set(orders.map(o=>o.customer_name||o.user_email).filter(Boolean))].sort()

  const filteredOrders = orders.filter(o => {
    if(fCustomer && !(o.customer_name||o.user_email||'').toLowerCase().includes(fCustomer.toLowerCase())) return false
    if(fProduct && !(o.items||[]).some(i=>i.name===fProduct)) return false
    if(fDateFrom && new Date(o.created_at) < new Date(fDateFrom)) return false
    if(fDateTo) { const end=new Date(fDateTo); end.setHours(23,59,59,999); if(new Date(o.created_at)>end) return false }
    if(fStatus!=='All' && o.status!==fStatus) return false
    return true
  })

  const hasOrderFilters = fCustomer||fProduct||fDateFrom||fDateTo||fStatus!=='All'
  const filteredRevenue = filteredOrders.reduce((s,o)=>s+Number(o.total),0)

  function clearOrderFilters() {
    setFCustomer(''); setFProduct(''); setFDateFrom(''); setFDateTo(''); setFStatus('All')
    setOrderPage(1)
  }

  useEffect(() => { setProdPage(1) }, [tab])
  useEffect(() => { setOrderPage(1) }, [fCustomer, fProduct, fDateFrom, fDateTo, fStatus])

  const pagedProducts  = products.slice((prodPage-1)*PER_PAGE.products, prodPage*PER_PAGE.products)
  const pagedOrders    = filteredOrders.slice((orderPage-1)*PER_PAGE.orders, orderPage*PER_PAGE.orders)
  const pagedCustomers = customers.slice((custPage-1)*PER_PAGE.customers, custPage*PER_PAGE.customers)

  if(!user) return null
  const previewSrc = imagePreview || form.image_url
  const opts       = form.quantity_options || []
  const basePrice  = parseFloat(form.price) || 0

  function stockBadge(p) {
    if(p.stock_quantity===null||p.stock_quantity===undefined) return null
    if(p.stock_quantity===0) return { label:'Out of stock', bg:'var(--red-pale)', color:'var(--red)' }
    if(p.stock_quantity<=LOW_STOCK) return { label:`Only ${p.stock_quantity} left`, bg:'var(--gold-pale)', color:'var(--gold)' }
    return { label:`${p.stock_quantity} in stock`, bg:'var(--green-pale)', color:'var(--green)' }
  }

  return (
    <>
      <Head><title>Admin — Adarshini Organic Farm</title></Head>
      <Header user={user} cartCount={0} onCartOpen={()=>{}} onAuthOpen={()=>{}} notifs={[]} setNotifs={()=>{}} />

      <main style={{maxWidth:1120,margin:'0 auto',padding:'28px 20px'}}>
        <div style={{marginBottom:28}}>
          <div style={{...serif,fontSize:30,fontWeight:700,color:'var(--green)',marginBottom:4}}>Farm Manager</div>
          <div style={{fontSize:13,color:'var(--muted)'}}>Adarshini Organic Farm — manage produce, orders and customers.</div>
        </div>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:28}}>
          {[{label:'Products',value:stats.products,icon:'🌿'},{label:'Orders',value:stats.orders,icon:'📦'},
            {label:'Customers',value:stats.customers,icon:'👥'},{label:'Revenue',value:'₹'+stats.revenue.toLocaleString('en-IN'),icon:'💰'}
          ].map(s=>(
            <div key={s.label} className="card" style={{padding:'16px 18px',display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:26}}>{s.icon}</span>
              <div><div style={{fontSize:20,fontWeight:700,color:'var(--green)'}}>{s.value}</div>
              <div style={{fontSize:12,color:'var(--muted)'}}>{s.label}</div></div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'2px solid var(--border)',marginBottom:24}}>
         {['products','orders','customers','farms','settings'].map(t=>(
  <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
    {t==='products'?'🌿 Products':t==='orders'?'📦 Orders':t==='customers'?'👥 Customers':t==='farms'?'🚜 Farms':'⚙️ Settings'}
  </button>
))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {tab==='products' && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 400px',gap:24,alignItems:'start'}}>
            <div>
              <div style={{fontWeight:600,fontSize:15,marginBottom:12}}>Inventory ({products.length})</div>
              {products.length===0
                ? <div className="card" style={{padding:48,textAlign:'center',color:'var(--muted)'}}>
                    <div style={{fontSize:36,marginBottom:10}}>🌱</div>
                    <div style={{fontWeight:600}}>No products yet — add one →</div>
                  </div>
                : <>
                    <div style={{display:'flex',flexDirection:'column',gap:9}}>
                      {pagedProducts.map(p => {
                        const sb = stockBadge(p)
                        return (
                          <div key={p.id} className="card" style={{padding:'12px 16px',display:'flex',alignItems:'center',gap:12,
                            opacity: p.is_visible===false ? 0.55 : 1}}>
                            <div style={{width:52,height:52,borderRadius:10,overflow:'hidden',background:'var(--green-pale)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                              {p.image_url?<img src={p.image_url} alt={p.name} style={{width:'100%',height:'100%',objectFit:'cover'}} />:<span style={{fontSize:26}}>🌿</span>}
                            </div>
                            <div style={{flex:1}}>
                              <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                                <span style={{fontWeight:600,fontSize:14}}>{p.name}</span>
                                {p.is_visible===false && <span style={{fontSize:10,background:'#eeeeee',color:'#888',padding:'2px 7px',borderRadius:8,fontWeight:600}}>Hidden</span>}
                                {!p.in_stock&&<span style={{fontSize:10,background:'var(--red-pale)',color:'var(--red)',padding:'2px 7px',borderRadius:8,fontWeight:600}}>Out of stock</span>}
                                {sb&&<span style={{fontSize:10,background:sb.bg,color:sb.color,padding:'2px 7px',borderRadius:8,fontWeight:600}}>{sb.label}</span>}
                                {p.quantity_options?.length>0&&<span style={{fontSize:10,background:'var(--gold-pale)',color:'var(--gold)',padding:'2px 7px',borderRadius:8,fontWeight:600}}>{p.quantity_options.length} size options</span>}
                              </div>
                              <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>
                                {p.category} · <span style={{color:'var(--green)',fontWeight:600}}>₹{p.price}</span>/{p.unit}
                              </div>
                            </div>
                            <div style={{display:'flex',gap:6}}>
                              <button onClick={()=>startEdit(p)} style={{padding:'5px 12px',border:'1px solid var(--border)',borderRadius:7,background:'transparent',cursor:'pointer',fontSize:12}}>Edit</button>
                              <button onClick={()=>deleteProduct(p.id,p.image_url)} style={{padding:'5px 12px',border:'1px solid var(--border)',borderRadius:7,background:'transparent',cursor:'pointer',fontSize:12,color:'var(--red)'}}>Delete</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <Pagination page={prodPage} total={products.length} perPage={PER_PAGE.products} onChange={setProdPage} />
                  </>
              }
            </div>

            {/* Add/Edit Form */}
            <div className="card" style={{padding:22,position:'sticky',top:80,maxHeight:'calc(100vh - 100px)',overflowY:'auto'}}>
              <div style={{fontWeight:700,fontSize:16,color:'var(--green)',marginBottom:18}}>
                {editing?'✏️ Edit Product':'＋ Add New Product'}
              </div>

              {/* Image upload */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:12,color:'var(--muted)',fontWeight:500,marginBottom:8}}>Product Photo *</div>
                <div onClick={()=>fileRef.current?.click()}
                  style={{width:'100%',height:150,borderRadius:12,overflow:'hidden',
                    border:`2px dashed ${previewSrc?'var(--green)':'var(--border)'}`,
                    background:previewSrc?'transparent':'var(--green-pale)',
                    display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',position:'relative'}}>
                  {previewSrc
                    ?<><img src={previewSrc} alt="preview" style={{width:'100%',height:'100%',objectFit:'cover'}} />
                        <button onClick={e=>{e.stopPropagation();clearImage()}}
                          style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.55)',color:'#fff',
                            border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',fontSize:14,
                            display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>✕</button>
                      </>
                    :<div style={{textAlign:'center',color:'var(--muted)'}}>
                        <div style={{fontSize:28,marginBottom:6}}>📷</div>
                        <div style={{fontSize:13,fontWeight:500}}>Click to upload</div>
                        <div style={{fontSize:11,marginTop:3}}>JPG, PNG · Max 5MB</div>
                      </div>
                  }
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onFileChange} style={{display:'none'}} />
                {uploading&&<div style={{fontSize:12,color:'var(--green)',marginTop:6}}>⏳ Uploading…</div>}
              </div>

              {[{label:'Product Name *',key:'name',placeholder:'e.g. Country Eggs'},
                {label:'Description',key:'description',placeholder:'Short description…',area:true}].map(f=>(
                <div key={f.key} style={{marginBottom:12}}>
                  <div style={{fontSize:12,color:'var(--muted)',fontWeight:500,marginBottom:4}}>{f.label}</div>
                  {f.area
                    ?<textarea className="inp" rows={2} value={form[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder} />
                    :<input className="inp" value={form[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder} />
                  }
                </div>
              ))}

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontSize:12,color:'var(--muted)',fontWeight:500,marginBottom:4}}>Base Price (₹) *</div>
                  <input className="inp" type="number" min="0" step="0.5" value={form.price} onChange={e=>set('price',e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <div style={{fontSize:12,color:'var(--muted)',fontWeight:500,marginBottom:4}}>Unit</div>
                  <select className="inp" value={form.unit} onChange={e=>set('unit',e.target.value)}>
                    {UNITS.map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div style={{marginBottom:12}}>
                <div style={{fontSize:12,color:'var(--muted)',fontWeight:500,marginBottom:4}}>Category</div>
                <select className="inp" value={form.category} onChange={e=>set('category',e.target.value)}>
                  {CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
<div style={{marginBottom:12}}>
  <div style={{fontSize:12,color:'var(--muted)',fontWeight:500,marginBottom:4}}>Farm Source</div>
  <select className="inp" value={form.farm_id} onChange={e=>set('farm_id',e.target.value)}>
    <option value="">— Select farm —</option>
    {farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
  </select>
</div>
              {/* Stock */}
              <div style={{marginBottom:16,padding:'14px 16px',background:'var(--green-pale)',borderRadius:12}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>📦 Available Stock</div>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>
                  Leave blank for unlimited. Stock deducts automatically on confirmed orders.
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,alignItems:'center'}}>
                  <input className="inp" type="number" min="0" step="0.5"
                    value={form.stock_quantity} onChange={e=>set('stock_quantity',e.target.value)} placeholder="e.g. 60" />
                  <span style={{fontSize:12,color:'var(--muted)',whiteSpace:'nowrap'}}>{form.unit||'units'}</span>
                </div>
                {form.stock_quantity!==''&&parseFloat(form.stock_quantity)>=0&&(
                  <div style={{marginTop:8,fontSize:12,color:'var(--green)',fontWeight:500}}>
                    ✓ {parseFloat(form.stock_quantity)===0?'Will be marked out of stock':`${form.stock_quantity} ${form.unit} available`}
                  </div>
                )}
              </div>
<div style={{ marginBottom:12 }}>
  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>
    Minimum Order Value (₹)
    <span style={{ fontWeight:400 }}> — optional</span>
  </div>
  <input className="inp" type="number" min="0" step="1"
    value={form.min_order_value}
    onChange={e => set('min_order_value', e.target.value)}
    placeholder="e.g. 90 (leave blank for no minimum)" />
  {form.min_order_value && (
    <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
      Customers must add at least ₹{form.min_order_value} worth of this product
    </div>
  )}
</div>
<div style={{ marginBottom:12 }}>
  <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>
    Loyalty Points per unit
    <span style={{ fontWeight:400 }}> — optional</span>
  </div>
  <input className="inp" type="number" min="0" step="1"
    value={form.points_per_unit || ''}
    onChange={e => set('points_per_unit', e.target.value)}
    placeholder="e.g. 5 (customer earns 5 pts per unit ordered)" />
  {form.points_per_unit > 0 && (
    <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
      Customer earns {form.points_per_unit} point{form.points_per_unit > 1 ? 's' : ''} per {form.unit || 'unit'} ordered
    </div>
  )}
</div>
              {/* Visibility + In stock toggles */}
              <div style={{marginBottom:10,display:'flex',alignItems:'center',gap:10}}>
                <input type="checkbox" id="in_stock" checked={form.in_stock}
                  onChange={e=>set('in_stock',e.target.checked)}
                  style={{width:16,height:16,accentColor:'var(--green)',cursor:'pointer'}} />
                <label htmlFor="in_stock" style={{fontSize:13,cursor:'pointer'}}>In stock (available to order)</label>
              </div>

              <div style={{marginBottom:18,display:'flex',alignItems:'center',gap:10}}>
                <input type="checkbox" id="is_visible" checked={form.is_visible!==false}
                  onChange={e=>set('is_visible',e.target.checked)}
                  style={{width:16,height:16,accentColor:'var(--green)',cursor:'pointer'}} />
                <label htmlFor="is_visible" style={{fontSize:13,cursor:'pointer'}}>
                  Visible on shop
                  <span style={{fontSize:11,color:'var(--muted)',marginLeft:6}}>
                    (uncheck to hide from customers)
                  </span>
                </label>
              </div>

              {/* Quantity Options */}
              <div style={{borderTop:'1px solid var(--border)',paddingTop:16,marginBottom:18}}>
                <div style={{fontWeight:600,fontSize:13,marginBottom:4}}>Size / Quantity Options</div>
                <div style={{fontSize:11,color:'var(--muted)',marginBottom:10,lineHeight:1.5}}>
                  Let customers pick a size. Price = base price × multiplier.
                </div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
                  {Object.keys(PRESETS).map(k=>(
                    <button key={k} onClick={()=>applyPreset(k)}
                      style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:'1.5px solid var(--border)',
                        background:'var(--green-pale)',color:'var(--green)',cursor:'pointer',fontWeight:500}}>{k}</button>
                  ))}
                  {opts.length>0&&<button onClick={()=>set('quantity_options',[])}
                    style={{fontSize:11,padding:'4px 10px',borderRadius:20,border:'1.5px solid var(--border)',
                      background:'var(--red-pale)',color:'var(--red)',cursor:'pointer',fontWeight:500}}>clear</button>}
                </div>
                {opts.length>0&&(
                  <div style={{display:'flex',flexDirection:'column',gap:7,marginBottom:10}}>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 80px 28px',gap:6,
                      fontSize:10,color:'var(--muted)',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>
                      <span>Label</span><span>Multiplier</span><span></span>
                    </div>
                    {opts.map((opt,i)=>(
                      <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 80px 28px',gap:6,alignItems:'center'}}>
                        <input className="inp" style={{padding:'6px 10px',fontSize:13}} value={opt.label}
                          placeholder="e.g. 500g" onChange={e=>updateOption(i,'label',e.target.value)} />
                        <input className="inp" type="number" min="0.1" step="0.05"
                          style={{padding:'6px 10px',fontSize:13}} value={opt.multiplier}
                          onChange={e=>updateOption(i,'multiplier',e.target.value)} />
                        <button onClick={()=>removeOption(i)}
                          style={{width:28,height:28,borderRadius:7,border:'1px solid var(--border)',
                            background:'transparent',cursor:'pointer',color:'var(--red)',fontSize:14,
                            display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                      </div>
                    ))}
                    {basePrice>0&&(
                      <div style={{padding:'8px 12px',background:'var(--green-pale)',borderRadius:8}}>
                        <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:4}}>Price preview:</div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                          {opts.filter(o=>o.label&&o.multiplier>0).map((o,i)=>(
                            <span key={i} style={{fontSize:12,background:'var(--card)',padding:'3px 10px',
                              borderRadius:12,border:'1px solid var(--border)',color:'var(--green)',fontWeight:600}}>
                              {o.label} — ₹{(basePrice*o.multiplier).toFixed(o.multiplier%1===0?0:2)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button onClick={addOption}
                  style={{fontSize:12,padding:'6px 14px',border:'1.5px dashed var(--green)',
                    borderRadius:8,background:'transparent',color:'var(--green)',cursor:'pointer',fontWeight:500}}>
                  ＋ Add option
                </button>
              </div>
{editing && (
  <div style={{ marginBottom:12, display:'flex', alignItems:'center', gap:10 }}>
    <input type="checkbox" id="notifyCustomers" checked={form.notifyCustomers !== false}
      onChange={e => set('notifyCustomers', e.target.checked)}
      style={{ width:16, height:16, accentColor:'var(--green)', cursor:'pointer' }} />
    <label htmlFor="notifyCustomers" style={{ fontSize:13, cursor:'pointer' }}>
      Notify customers about this update
    </label>
  </div>
)}
              <div style={{display:'flex',gap:8}}>
                <button className="btn-g" style={{flex:1,padding:10}} onClick={saveProduct} disabled={saving||uploading}>
                  {uploading?'Uploading…':saving?'Saving…':editing?'💾 Update':'＋ Add Product'}
                </button>
                {editing&&<button className="btn-o" style={{padding:'10px 14px'}} onClick={resetForm}>Cancel</button>}
              </div>
              <div style={{marginTop:12,padding:'10px 12px',background:'var(--green-pale)',borderRadius:9,fontSize:12,color:'var(--muted)',lineHeight:1.5}}>
                🔔 Customers notified on every add/update. Stock deducts on confirmed orders.
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab==='orders' && (
          <div>
            <div className="card" style={{padding:'16px 18px',marginBottom:16}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontWeight:600,fontSize:14}}>🔍 Filter Orders</div>
                {hasOrderFilters&&(
                  <button onClick={clearOrderFilters}
                    style={{fontSize:12,color:'var(--red)',background:'var(--red-pale)',border:'none',
                      borderRadius:8,padding:'4px 12px',cursor:'pointer',fontWeight:500}}>
                    Clear filters
                  </button>
                )}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr',gap:10}}>
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>Customer</div>
                  <input className="inp" style={{padding:'7px 10px',fontSize:13}}
                    list="cust-list" placeholder="Search name…"
                    value={fCustomer} onChange={e=>setFCustomer(e.target.value)} />
                  <datalist id="cust-list">
                    {allCustomers.map(c=><option key={c} value={c} />)}
                  </datalist>
                </div>
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>Product</div>
                  <select className="inp" style={{padding:'7px 10px',fontSize:13}}
                    value={fProduct} onChange={e=>setFProduct(e.target.value)}>
                    <option value="">All products</option>
                    {allOrderProducts.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>From date</div>
                  <input className="inp" type="date" style={{padding:'7px 10px',fontSize:13}}
                    value={fDateFrom} onChange={e=>setFDateFrom(e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>To date</div>
                  <input className="inp" type="date" style={{padding:'7px 10px',fontSize:13}}
                    value={fDateTo} onChange={e=>setFDateTo(e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>Status</div>
                  <select className="inp" style={{padding:'7px 10px',fontSize:13}}
                    value={fStatus} onChange={e=>setFStatus(e.target.value)}>
                    <option value="All">All statuses</option>
                    {ORDER_STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
                                        <div>
  <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>Farm</div>
  <select className="inp" style={{padding:'7px 10px',fontSize:13}}
    value={fFarm} onChange={e=>setFFarm(e.target.value)}>
    <option value="All">All farms</option>
    {farms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
  </select>
</div>
              </div>
            </div>

<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
  <div style={{fontWeight:600,fontSize:15}}>
    {hasOrderFilters?`${filteredOrders.length} of ${orders.length} orders`:`All Orders (${orders.length})`}
  </div>
    
  <div style={{display:'flex',gap:10,alignItems:'center'}}>
    {filteredOrders.length>0&&(
      <div style={{fontSize:13,color:'var(--muted)'}}>
        Total: <span style={{color:'var(--green)',fontWeight:700}}>₹{filteredRevenue.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
    )}
    <button
      onClick={() => {
        const params = new URLSearchParams()
        if (fDateFrom) params.set('from', fDateFrom)
        if (fDateTo)   params.set('to', fDateTo)
        if (fStatus !== 'All') params.set('status', fStatus)
        
        if (fFarm !== 'All') params.set('farm_id', fFarm)
        window.open(`/api/export/orders?${params.toString()}`, '_blank')
      }}
      style={{fontSize:12,padding:'6px 14px',border:'1.5px solid var(--green)',
        borderRadius:8,background:'var(--green-pale)',color:'var(--green)',
        cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:5}}>
      📥 Export CSV
    </button>
  </div>
</div>

            {filteredOrders.length===0
              ?<div className="card" style={{padding:48,textAlign:'center',color:'var(--muted)'}}>
                  <div style={{fontSize:36,marginBottom:10}}>📦</div>
                  <div style={{fontWeight:600}}>{orders.length===0?'No orders yet':'No orders match your filters'}</div>
                  {hasOrderFilters&&<button onClick={clearOrderFilters} className="btn-o" style={{marginTop:14,padding:'7px 18px',fontSize:13}}>Clear filters</button>}
                </div>
              :<>
                  <div style={{display:'flex',flexDirection:'column',gap:12}}>
                    {pagedOrders.map(o=>(
                      <div key={o.id} className="card" style={{padding:18}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                          <div>
                            <div style={{fontWeight:600,fontSize:15}}>{o.customer_name||o.user_email}</div>
                            <div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>#{o.id.slice(0,8).toUpperCase()} · {new Date(o.created_at).toLocaleString('en-IN')}</div>
                            <div style={{fontSize:12,color:'var(--muted)'}}>📍 {o.address}</div>
                            <div style={{fontSize:12,color:'var(--muted)'}}>📞 {o.phone}</div>
                            <div style={{fontSize:12,color:'var(--muted)'}}>
                             {o.payment_method==='razorpay'
  ? o.payment_status==='paid'
    ? '💳 Paid Online'
    : '⏳ Online Payment Pending'
  : '💵 Cash on Delivery'}
{o.payment_status==='paid'&&<span style={{color:'var(--green)',fontWeight:600}}> ✓</span>}
                            </div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{...serif,fontSize:20,fontWeight:700,color:'var(--green)',marginBottom:8}}>₹{Number(o.total).toFixed(2)}</div>
                            <select value={o.status} disabled={updatingOrder===o.id}
                              onChange={e=>updateOrderStatus(o,e.target.value)}
                              style={{padding:'6px 10px',borderRadius:8,border:'1.5px solid var(--green)',
                                background:'var(--green-pale)',color:'var(--green)',fontWeight:600,fontSize:12,cursor:'pointer',minWidth:160}}>
                              {ORDER_STATUSES.map(s=><option key={s}>{s}</option>)}
                            </select>
                            {updatingOrder===o.id&&<div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>Notifying…</div>}
                          </div>
                        </div>
                        <div style={{borderTop:'1px solid var(--border)',paddingTop:10,display:'flex',flexWrap:'wrap',gap:6}}>
                          {(o.items||[]).map((item,i)=>(
                            <span key={i} style={{fontSize:12,background:'var(--bg)',padding:'3px 10px',borderRadius:12,display:'flex',alignItems:'center',gap:5}}>
                              {item.image_url&&<img src={item.image_url} alt="" style={{width:16,height:16,borderRadius:3,objectFit:'cover'}} />}
                              {item.name}{item.selected_option?` (${item.selected_option})`:''} × {item.qty} — ₹{((item.effective_price??item.price)*item.qty).toFixed(0)}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <Pagination page={orderPage} total={filteredOrders.length} perPage={PER_PAGE.orders} onChange={setOrderPage} />
                </>
            }
          </div>
        )}

        {/* ── CUSTOMERS TAB ── */}
        {tab==='customers' && (
          <div>
            <div style={{fontWeight:600,fontSize:15,marginBottom:12}}>Registered Customers ({customers.length})</div>
            {customers.length===0
              ?<div className="card" style={{padding:48,textAlign:'center',color:'var(--muted)'}}>
                  <div style={{fontSize:36,marginBottom:10}}>👥</div><div style={{fontWeight:600}}>No customers yet</div>
                </div>
              :<>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {pagedCustomers.map(c=>(
  <div key={c.id} className="card" style={{padding:'12px 18px',display:'flex',alignItems:'center',gap:14}}>
    <div style={{width:38,height:38,borderRadius:'50%',background:'var(--green-pale)',
      display:'flex',alignItems:'center',justifyContent:'center',color:'var(--green)',fontWeight:700,fontSize:14,flexShrink:0}}>
      {(c.name||c.email||'C').charAt(0).toUpperCase()}
    </div>
    <div style={{flex:1}}>
      <div style={{fontWeight:600,fontSize:14}}>{c.name||'(no name)'}</div>
      <div style={{fontSize:12,color:'var(--muted)'}}>{c.email}</div>
      <div style={{fontSize:11,color:'var(--muted)',marginTop:2}}>
        ⭐ {c.points_balance||0} points
      </div>
    </div>
    <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:6}}>
      <div style={{fontSize:12,color:'var(--green)',fontWeight:600}}>{orders.filter(o=>o.user_email===c.email).length} order(s)</div>
      <div style={{fontSize:11,color:'var(--muted)'}}>{c.created_at ? `Joined ${new Date(c.created_at).toLocaleDateString('en-IN')}` : ''}</div>
      {/* Loyalty toggle */}
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        <span style={{fontSize:11,color:'var(--muted)'}}>Loyalty</span>
        <div onClick={async () => {
          const newVal = !c.loyalty_enabled
          await fetch('/api/admin/toggle-loyalty', {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ user_id: c.id, loyalty_enabled: newVal })
          })
          setCustomers(prev => prev.map(x => x.id===c.id ? {...x, loyalty_enabled: newVal} : x))
        }}
          style={{width:36,height:20,borderRadius:10,cursor:'pointer',position:'relative',
            background: c.loyalty_enabled ? 'var(--green)' : 'var(--border)',
            transition:'background .2s'}}>
          <div style={{position:'absolute',top:2,left:c.loyalty_enabled?18:2,width:16,height:16,
            borderRadius:'50%',background:'#fff',transition:'left .2s',
            boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}} />
        </div>
      </div>
    </div>
  </div>
))}
                  </div>
                  <Pagination page={custPage} total={customers.length} perPage={PER_PAGE.customers} onChange={setCustPage} />
                </>
            }
          </div>
        )}
{/* ── FARMS TAB ── */}
{tab==='farms' && <FarmsTab farms={farms} onReload={loadFarms} showToast={showToast} />}
{/* ── SETTINGS TAB ── */}
{tab==='settings' && (
  <div style={{maxWidth:520}}>
    <div style={{fontWeight:600,fontSize:15,marginBottom:20}}>⚙️ Farm Settings</div>

    <div className="card" style={{padding:24,marginBottom:16}}>
      <div style={{fontWeight:600,fontSize:14,color:'var(--green)',marginBottom:18}}>
        ⭐ Loyalty Points
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:12,color:'var(--muted)',fontWeight:600,marginBottom:6,
          textTransform:'uppercase',letterSpacing:0.5}}>Points to Rupee Rate</div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:13,color:'var(--muted)'}}>1 point =</span>
          <input className="inp" type="number" min="0.1" step="0.1"
            style={{width:100}}
            value={settings.points_to_rupee_rate}
            onChange={e=>setSettings(s=>({...s,points_to_rupee_rate:e.target.value}))} />
          <span style={{fontSize:13,color:'var(--muted)'}}>₹</span>
        </div>
        <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>
          e.g. if set to 0.5 → 10 points = ₹5 discount at checkout
        </div>
      </div>

      <div style={{marginBottom:18}}>
        <div style={{fontSize:12,color:'var(--muted)',fontWeight:600,marginBottom:6,
          textTransform:'uppercase',letterSpacing:0.5}}>Referral Reward Points</div>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <input className="inp" type="number" min="0" step="1"
            style={{width:100}}
            value={settings.referral_reward_points}
            onChange={e=>setSettings(s=>({...s,referral_reward_points:e.target.value}))} />
          <span style={{fontSize:13,color:'var(--muted)'}}>points when friend places first order</span>
        </div>
        <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>
          Currently: referrer earns {settings.referral_reward_points} points = ₹{(parseFloat(settings.referral_reward_points||0)*parseFloat(settings.points_to_rupee_rate||1)).toFixed(0)} value
        </div>
      </div>

      <button className="btn-g" style={{padding:'10px 24px'}} onClick={saveSettings}>
        {settingsSaved ? '✅ Saved!' : '💾 Save Settings'}
      </button>
    </div>
  </div>
)}
      </main>

      {toast&&(
        <div style={{position:'fixed',bottom:24,left:'50%',transform:'translateX(-50%)',
          background:'var(--text)',color:'#fff',padding:'11px 22px',borderRadius:12,
          fontSize:13,zIndex:999,whiteSpace:'nowrap',boxShadow:'0 6px 20px rgba(0,0,0,.22)',fontWeight:500}}>
          {toast}
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModal && (
        <div className="overlay" onClick={e => e.target===e.currentTarget && setCancelModal(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{...serif,fontSize:20,fontWeight:700,color:'var(--red)'}}>❌ Cancel Order</div>
              <button onClick={()=>setCancelModal(null)}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'var(--muted)'}}>✕</button>
            </div>
            <div style={{padding:'12px 14px',background:'var(--bg)',borderRadius:10,marginBottom:18}}>
              <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{cancelModal.customer_name||cancelModal.user_email}</div>
              <div style={{fontSize:12,color:'var(--muted)',marginBottom:4}}>
                #{cancelModal.id.slice(0,8).toUpperCase()} · ₹{Number(cancelModal.total).toFixed(2)}
              </div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {(cancelModal.items||[]).map((item,i)=>(
                  <span key={i} style={{fontSize:11,background:'var(--card)',padding:'2px 8px',borderRadius:10,border:'1px solid var(--border)'}}>
                    {item.name}{item.selected_option?` (${item.selected_option})`:''} × {item.qty}
                  </span>
                ))}
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:6,color:'var(--text)'}}>
                Reason for cancellation <span style={{color:'var(--muted)',fontWeight:400}}>(sent to customer)</span>
              </div>
              <textarea className="inp" rows={3} value={cancelReason}
                onChange={e=>setCancelReason(e.target.value)}
                placeholder="e.g. Sorry, this item is currently out of stock…"
                style={{fontSize:13,lineHeight:1.6}} />
              <div style={{fontSize:11,color:'var(--muted)',marginTop:6}}>
                The customer will receive this reason via in-app notification and email.
              </div>
            </div>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,color:'var(--muted)',fontWeight:600,marginBottom:7,textTransform:'uppercase',letterSpacing:0.5}}>Quick reasons</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {['Item currently out of stock','Unable to deliver to your area today','Ordered quantity not available','Duplicate order detected','Delivery address is too far'].map(r=>(
                  <button key={r} onClick={()=>setCancelReason(r)}
                    style={{fontSize:11,padding:'5px 11px',borderRadius:20,cursor:'pointer',fontWeight:500,
                      border:`1.5px solid ${cancelReason===r?'var(--red)':'var(--border)'}`,
                      background:cancelReason===r?'var(--red-pale)':'transparent',
                      color:cancelReason===r?'var(--red)':'var(--muted)',transition:'all .15s'}}>
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setCancelModal(null)} className="btn-o" style={{flex:1,padding:11}}>Keep Order</button>
              <button onClick={confirmCancellation} disabled={updatingOrder===cancelModal.id}
                style={{flex:1,padding:11,background:'var(--red)',color:'#fff',border:'none',
                  borderRadius:9,cursor:'pointer',fontSize:14,fontWeight:500,
                  opacity:updatingOrder===cancelModal.id?0.7:1}}>
                {updatingOrder===cancelModal.id?'Cancelling…':'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
// ============================================================
// FarmsTab component — add at the BOTTOM of pages/admin.js
// before the final closing brace
// ============================================================

function FarmsTab({ farms, onReload, showToast }) {
  const BLANK_FARM = { id:'', name:'', owner_name:'', email:'', phone:'', platform_fee:'0' }
  const [form, setForm]     = useState(BLANK_FARM)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function saveFarm() {
    if (!form.name || !form.owner_name || !form.email) {
      showToast('Name, owner name and email are required'); return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/farms', {
        method:  editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showToast(editing ? '✅ Farm updated!' : '✅ Farm added!')
      setForm(BLANK_FARM); setEditing(false); onReload()
    } catch (e) { showToast('Error: ' + e.message) }
    finally { setSaving(false) }
  }

  async function toggleActive(farm) {
    await fetch('/api/admin/farms', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ...farm, is_active: !farm.is_active }),
    })
    showToast(farm.is_active ? 'Farm disabled' : 'Farm enabled')
    onReload()
  }

  const serif = { fontFamily: 'Playfair Display, serif' }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:24, alignItems:'start' }}>
      {/* Farm list */}
      <div>
        <div style={{ fontWeight:600, fontSize:15, marginBottom:12 }}>Registered Farms ({farms.length})</div>
        {farms.length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🚜</div>
            <div style={{ fontWeight:600 }}>No farms yet — add one →</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {farms.map(f => (
              <div key={f.id} className="card" style={{ padding:'14px 18px',
                opacity: f.is_active ? 1 : 0.55 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                      <span style={{ fontWeight:700, fontSize:15 }}>{f.name}</span>
                      {!f.is_active && (
                        <span style={{ fontSize:10, background:'var(--red-pale)', color:'var(--red)',
                          padding:'2px 8px', borderRadius:8, fontWeight:600 }}>Disabled</span>
                      )}
                    </div>
                    <div style={{ fontSize:13, color:'var(--muted)', lineHeight:1.8 }}>
                      👤 {f.owner_name}<br/>
                      ✉️ {f.email}
                      {f.phone && <><br/>📞 {f.phone}</>}
                    </div>
                    <div style={{ marginTop:8, display:'flex', gap:10, flexWrap:'wrap' }}>
                      <span style={{ fontSize:12, background:'var(--green-pale)', color:'var(--green)',
                        padding:'3px 10px', borderRadius:8, fontWeight:600 }}>
                        Platform fee: {f.platform_fee}%
                      </span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                    <button onClick={() => { setForm({ ...f, platform_fee: String(f.platform_fee) }); setEditing(true) }}
                      style={{ padding:'5px 12px', border:'1px solid var(--border)', borderRadius:7,
                        background:'transparent', cursor:'pointer', fontSize:12 }}>Edit</button>
                    <button onClick={() => toggleActive(f)}
                      style={{ padding:'5px 12px', border:'1px solid var(--border)', borderRadius:7,
                        background:'transparent', cursor:'pointer', fontSize:12,
                        color: f.is_active ? 'var(--red)' : 'var(--green)' }}>
                      {f.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit form */}
      <div className="card" style={{ padding:22, position:'sticky', top:80 }}>
        <div style={{ fontWeight:700, fontSize:16, color:'var(--green)', marginBottom:18 }}>
          {editing ? '✏️ Edit Farm' : '＋ Add New Farm'}
        </div>

        {[
          { label:'Farm Name *',   key:'name',       placeholder:'e.g. Green Valley Farm' },
          { label:'Owner Name *',  key:'owner_name', placeholder:'Full name of owner' },
          { label:'Email *',       key:'email',      placeholder:'farm@example.com' },
          { label:'Phone',         key:'phone',      placeholder:'+91 98765 43210' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom:12 }}>
            <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>{f.label}</div>
            <input className="inp" value={form[f.key]} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
          </div>
        ))}

        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:12, color:'var(--muted)', fontWeight:500, marginBottom:4 }}>
            Platform Fee (%)
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input className="inp" type="number" min="0" max="100" step="0.5"
              value={form.platform_fee} onChange={e => set('platform_fee', e.target.value)}
              placeholder="e.g. 10" style={{ flex:1 }} />
            <span style={{ fontSize:13, color:'var(--muted)', whiteSpace:'nowrap' }}>% of order total</span>
          </div>
          {parseFloat(form.platform_fee) > 0 && (
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:6, lineHeight:1.6 }}>
              Example: ₹1000 order → fee ₹{(1000 * parseFloat(form.platform_fee) / 100).toFixed(0)} → farm gets ₹{(1000 - 1000 * parseFloat(form.platform_fee) / 100).toFixed(0)}
            </div>
          )}
        </div>

        <div style={{ padding:'10px 12px', background:'var(--green-pale)', borderRadius:9,
          fontSize:12, color:'var(--muted)', lineHeight:1.5, marginBottom:14 }}>
          💡 Platform fee is deducted in the export report. Use 0 for Adarshini (your own farm).
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-g" style={{ flex:1, padding:10 }} onClick={saveFarm} disabled={saving}>
            {saving ? 'Saving…' : editing ? '💾 Update Farm' : '＋ Add Farm'}
          </button>
          {editing && (
            <button className="btn-o" style={{ padding:'10px 14px' }}
              onClick={() => { setForm(BLANK_FARM); setEditing(false) }}>Cancel</button>
          )}
        </div>
      </div>
    </div>
  )
}

