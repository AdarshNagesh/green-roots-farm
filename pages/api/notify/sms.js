/**
 * MSG91 SMS + WhatsApp API route
 * Docs: https://docs.msg91.com/
 * 
 * For SMS:  uses Flow/Template API (DLT-approved template required in India)
 * For WA:   uses WhatsApp Business API via MSG91
 */

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const { phone, type, order } = req.body
  if (!phone || !order) return res.status(400).json({ error: 'Missing phone or order' })

  // Clean phone number (ensure +91 for India)
  const cleanPhone = phone.replace(/\D/g, '')
  const e164       = cleanPhone.startsWith('91') ? cleanPhone : '91' + cleanPhone

  const messages = {
    confirmed:  `Hi ${order.customer_name}, your Green Roots Farm order of Rs.${order.total} is CONFIRMED! We'll prepare your fresh organic produce soon. Track at: ${process.env.NEXT_PUBLIC_SITE_URL}/orders`,
    preparing:  `Hi ${order.customer_name}, your Green Roots Farm order is being freshly packed for you. Get ready for farm-fresh goodness!`,
    delivering: `Hi ${order.customer_name}, your Green Roots Farm order is OUT FOR DELIVERY! Please be available at: ${order.address}`,
    delivered:  `Hi ${order.customer_name}, your Green Roots Farm order has been DELIVERED! Enjoy your fresh organic produce. Thank you!`,
    cancelled:  `Hi ${order.customer_name}, your Green Roots Farm order has been cancelled. Contact us for help.`,
  }
  const smsText = messages[type] || messages.confirmed

  const results = {}

  // ── SMS via MSG91 Flow API ────────────────────────────────────────────────
  try {
    const smsRes = await fetch('https://api.msg91.com/api/v5/flow/', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'authkey':       process.env.MSG91_AUTH_KEY,
      },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        sender:      process.env.MSG91_SENDER_ID || 'GRNRTS',
        short_url:   '0',
        mobiles:     e164,
        // Variables for your DLT-approved template:
        // Replace VAR1, VAR2 etc with your template variable names
        VAR1: order.customer_name,
        VAR2: order.total,
        VAR3: type,
      }),
    })
    const smsData = await smsRes.json()
    results.sms = smsData
  } catch (err) {
    console.error('MSG91 SMS error:', err)
    results.sms = { error: err.message }
  }

  // ── WhatsApp via MSG91 WhatsApp API ───────────────────────────────────────
  // Only send WhatsApp for key status events
  if (['confirmed', 'delivering', 'delivered'].includes(type)) {
    try {
      const waRes = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey':      process.env.MSG91_AUTH_KEY,
        },
        body: JSON.stringify({
          integrated_number: process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER,
          content_type:      'template',
          payload: {
            to:       e164,
            type:     'template',
            template: {
              name:     `order_${type}`,   // your MSG91 WhatsApp template name
              language: { code: 'en' },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: order.customer_name },
                  { type: 'text', text: String(order.total) },
                  { type: 'text', text: order.address || '' },
                ],
              }],
            },
          },
        }),
      })
      const waData = await waRes.json()
      results.whatsapp = waData
    } catch (err) {
      console.error('MSG91 WhatsApp error:', err)
      results.whatsapp = { error: err.message }
    }
  }

  // Always return 200 — notification failure should not break order flow
  res.status(200).json({ success: true, results })
}
