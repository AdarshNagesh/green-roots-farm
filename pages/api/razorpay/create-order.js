import Razorpay from 'razorpay'

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

export default async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' })

  const { amount, currency = 'INR', receipt } = req.body

  if (!amount || amount <= 0)
    return res.status(400).json({ error: 'Invalid amount' })

  try {
    const order = await razorpay.orders.create({
      amount:   Math.round(amount * 100), // paise
      currency,
      receipt:  receipt || `rcpt_${Date.now()}`,
    })
    res.status(200).json({ orderId: order.id, amount: order.amount, currency: order.currency })
  } catch (err) {
    console.error('Razorpay create error:', err)
    res.status(500).json({ error: err.message })
  }
}
