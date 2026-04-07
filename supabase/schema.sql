-- ============================================================
-- GREEN ROOTS FARM v2 — Full Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text,
  email      text,
  phone      text,
  is_admin   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 2. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  price       numeric(10,2) NOT NULL,
  unit        text DEFAULT 'kg',
  category    text DEFAULT 'Vegetables',
  emoji       text DEFAULT '🌿',
  in_stock    boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 3. ORDERS (with payment fields)
CREATE TABLE IF NOT EXISTS public.orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES auth.users(id),
  user_email          text,
  customer_name       text,
  address             text,
  phone               text,
  items               jsonb NOT NULL DEFAULT '[]',
  total               numeric(10,2) NOT NULL,
  status              text DEFAULT 'Payment Pending',
  payment_status      text DEFAULT 'pending',
  payment_method      text DEFAULT 'cod',
  razorpay_order_id   text,
  razorpay_payment_id text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- 4. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  message    text NOT NULL,
  type       text DEFAULT 'new',
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- HELPER: avoids RLS infinite recursion when admin checks profile
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- ============================================================
-- TRIGGER 1: Notify ALL customers when product added/updated
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_customers_on_product_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  notif_msg  text;
  notif_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    notif_msg  := 'New item available: ' || NEW.emoji || ' ' || NEW.name || ' at Rs.' || NEW.price || ' per ' || NEW.unit;
    notif_type := 'new';
  ELSE
    IF OLD.price = NEW.price AND OLD.name = NEW.name AND OLD.in_stock = NEW.in_stock THEN
      RETURN NEW;
    END IF;
    notif_msg  := 'Updated: ' || NEW.emoji || ' ' || NEW.name || ' is now Rs.' || NEW.price || ' per ' || NEW.unit;
    notif_type := 'update';
  END IF;
  INSERT INTO public.notifications (user_id, message, type)
  SELECT id, notif_msg, notif_type FROM public.profiles WHERE is_admin = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_change_notify ON public.products;
CREATE TRIGGER product_change_notify
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_customers_on_product_change();

-- ============================================================
-- TRIGGER 2: Notify customer when their ORDER STATUS changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_customer_on_order_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  notif_msg text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  notif_msg := CASE NEW.status
    WHEN 'Confirmed'        THEN 'Your order has been confirmed! We are preparing your produce.'
    WHEN 'Preparing'        THEN 'Your order is being freshly packed for you.'
    WHEN 'Out for Delivery' THEN 'Your order is on the way! Please be available to receive it.'
    WHEN 'Delivered'        THEN 'Your order has been delivered. Enjoy your fresh produce!'
    WHEN 'Cancelled'        THEN 'Your order has been cancelled. Contact us for any queries.'
    ELSE 'Your order status has been updated to: ' || NEW.status
  END;
  INSERT INTO public.notifications (user_id, message, type)
  VALUES (NEW.user_id, notif_msg, 'order');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_status_notify ON public.orders;
CREATE TRIGGER order_status_notify
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_customer_on_order_status();

-- ============================================================
-- TRIGGER 3: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email, false
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES (clean slate)
-- ============================================================
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname='public' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.' || r.tablename;
  END LOOP;
END $$;

-- Profiles
CREATE POLICY "Own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin all profiles" ON public.profiles FOR SELECT USING (public.is_admin());

-- Products
CREATE POLICY "Public products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admin insert product" ON public.products FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admin update product" ON public.products FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admin delete product" ON public.products FOR DELETE USING (public.is_admin());

-- Orders
CREATE POLICY "Own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Insert own order" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin all orders" ON public.orders FOR SELECT USING (public.is_admin());
CREATE POLICY "Admin update order" ON public.orders FOR UPDATE USING (public.is_admin());

-- Notifications
CREATE POLICY "Own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- ============================================================
-- AFTER SIGNING UP ON THE SITE, RUN THIS TO BECOME ADMIN:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'you@youremail.com';
-- ============================================================
