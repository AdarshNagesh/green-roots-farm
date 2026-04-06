# 🌿 Green Roots Farm — Deployment Guide

A full-stack organic farm e-commerce site built with **Next.js + Supabase**, deployable to **Vercel** for free.

---

## What You'll Need (all free)
- A [Supabase](https://supabase.com) account
- A [Vercel](https://vercel.com) account
- A [GitHub](https://github.com) account

---

## Step 1 — Set Up Supabase

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Name it `green-roots-farm`, set a strong database password, choose a region close to you
3. Wait ~2 minutes for it to spin up
4. Go to the **SQL Editor** (left sidebar)
5. Click **New query**, paste the entire contents of `supabase/schema.sql`, and click **Run**
6. You should see "Success" — this creates all tables, triggers, and policies

---

## Step 2 — Get Your Supabase Keys

1. In Supabase, go to **Settings → API**
2. Copy:
   - **Project URL** (looks like `https://abcxyz.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 3 — Push Code to GitHub

1. Create a new repository on GitHub (name it `green-roots-farm`)
2. Upload all these project files to it (drag and drop on GitHub works fine)

---

## Step 4 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repository
3. In the **Environment Variables** section, add these three:

   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
   | `NEXT_PUBLIC_ADMIN_EMAIL` | **Your email** (this becomes the farmer/admin account) |

4. Click **Deploy** — Vercel will build and give you a live URL in ~2 minutes!

---

## Step 5 — Create Your Admin Account

1. Visit your live site (e.g. `https://green-roots-farm.vercel.app`)
2. Click **Sign In → Register free**
3. Register using the **same email** you set as `NEXT_PUBLIC_ADMIN_EMAIL`
4. Now go to Supabase → **SQL Editor** → run this one line:
   ```sql
   UPDATE public.profiles SET is_admin = true WHERE email = 'your@email.com';
   ```
   (Replace with your actual email)
5. Log out and log back in — you'll now see the **Admin Panel** button!

---

## How It Works

### For You (Farmer/Admin)
- Go to **Admin Panel** → **Products** tab
- Add produce with name, price, emoji, category, description
- Every time you add or update a product, **all registered customers automatically get a notification**
- View all orders with customer details and update their delivery status
- See your registered customer list

### For Customers
- Browse and search your produce
- Register/login to add items to cart
- After registering, they see a 🔔 bell — it lights up in **real time** whenever you add or change a product
- Add to cart → checkout with name, address, phone

### Notifications (How they work)
The magic is in the **PostgreSQL trigger** in `supabase/schema.sql`:
- When you add/update a product in the database, a trigger fires automatically
- It inserts a notification row for **every registered customer**
- Customers' browsers are subscribed via **Supabase Realtime** — the bell badge updates instantly without any page refresh

---

## Running Locally (for testing)

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file
cp .env.local.example .env.local
# Edit .env.local with your Supabase keys

# 3. Run development server
npm run dev

# 4. Open http://localhost:3000
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (React) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime |
| Hosting | Vercel |
| Cost | **Free** (on free tiers) |

---

## Upgrading Later
- **Custom domain**: Buy a domain (e.g. `greenrootsfarm.in`) on GoDaddy/Namecheap (~₹800/yr) and connect it in Vercel settings
- **Payment gateway**: Add Razorpay for online payments
- **Email notifications**: Add Resend.com to send order confirmation emails
- **SMS alerts**: Add Twilio or MSG91 for WhatsApp/SMS order updates
