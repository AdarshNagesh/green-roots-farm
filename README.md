# 🌿 Green Roots Farm v2 — Deployment Guide

Full-stack organic farm e-commerce: **Next.js + Supabase + Razorpay + Resend + MSG91**

---

## Features

| Feature | How it works |
|---|---|
| Product listing + cart | React state, Supabase realtime |
| Customer registration + login | Supabase Auth |
| Payment — COD or Online | Razorpay checkout with HMAC verification |
| Order tracking page | /orders with live progress bar |
| Product notifications | DB trigger → Realtime → bell badge |
| Order status notifications | DB trigger → in-app + email + SMS/WhatsApp |
| Email (order updates) | Resend API — HTML template |
| SMS + WhatsApp | MSG91 Flow API + WhatsApp Business |
| Admin panel | Products, Orders, Customers (all fixed) |

---

## Step 1 — Supabase Setup

1. Create free account at supabase.com → New Project
2. SQL Editor → New query → paste entire supabase/schema.sql → Run
3. Settings → API, copy: Project URL, anon key, service_role key

---

## Step 2 — Razorpay

1. Sign up at razorpay.com
2. Settings → API Keys → Generate Test Key
3. Copy Key ID and Key Secret

---

## Step 3 — Resend Email

1. Sign up at resend.com (free: 3000 emails/month)
2. API Keys → Create API Key
3. Domains → Add Domain → verify with DNS records
4. Testing: use onboarding@resend.dev as from-address

---

## Step 4 — MSG91 SMS + WhatsApp

1. Sign up at msg91.com
2. API → Authkey → copy auth key
3. SMS: Create DLT-approved sender ID + template → create Flow → copy Template ID
4. WhatsApp (optional): Connect WhatsApp Business number, create message templates

---

## Step 5 — Deploy to Vercel

1. Push all files to a GitHub repo
2. vercel.com → Import Project
3. Add these Environment Variables:

   NEXT_PUBLIC_SUPABASE_URL         = https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY    = eyJ...
   SUPABASE_SERVICE_ROLE_KEY        = eyJ...   (NEVER expose publicly)
   NEXT_PUBLIC_ADMIN_EMAIL          = you@youremail.com
   RAZORPAY_KEY_ID                  = rzp_test_xxxx
   RAZORPAY_KEY_SECRET              = xxxx
   NEXT_PUBLIC_RAZORPAY_KEY_ID      = rzp_test_xxxx
   RESEND_API_KEY                   = re_xxxx
   RESEND_FROM_EMAIL                = orders@yourdomain.com
   MSG91_AUTH_KEY                   = xxxx
   MSG91_SENDER_ID                  = GRNRTS
   MSG91_TEMPLATE_ID                = xxxx
   MSG91_WHATSAPP_INTEGRATED_NUMBER = 91xxxxxxxxxx
   NEXT_PUBLIC_SITE_URL             = https://your-vercel-url.vercel.app

4. Click Deploy

---

## Step 6 — Make Yourself Admin

1. Register on your live site using the email set in NEXT_PUBLIC_ADMIN_EMAIL
2. In Supabase SQL Editor run:
   UPDATE public.profiles SET is_admin = true WHERE email = 'you@youremail.com';
3. Log out and back in — Admin Panel appears

---

## Running Locally

   npm install
   cp .env.local.example .env.local
   # Fill in your keys
   npm run dev
   # Open http://localhost:3000

---

## Notification Flow

   Admin changes order status
           |
    Supabase DB trigger fires
           |
     +-----+------------------+
     |                        |
   In-app bell           API routes called
   (Realtime WebSocket)  /api/notify/email  -> Resend (HTML email)
                         /api/notify/sms    -> MSG91 (SMS + WhatsApp)

---

## Cost Summary

   Next.js on Vercel    — Free
   Supabase             — Free (500MB DB)
   Razorpay             — 2% per transaction
   Resend               — Free (3000 emails/month)
   MSG91 SMS            — ~Rs.0.20 per SMS
   MSG91 WhatsApp       — ~Rs.0.50 per message
