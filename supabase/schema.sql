-- ============================================================
-- GREEN ROOTS FARM — Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- 1. PROFILES (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      text,
  email     text,
  is_admin  boolean DEFAULT false,
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

-- 3. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES auth.users(id),
  user_email     text,
  customer_name  text,
  address        text,
  phone          text,
  items          jsonb NOT NULL DEFAULT '[]',
  total          numeric(10,2) NOT NULL,
  status         text DEFAULT 'Confirmed',
  created_at     timestamptz DEFAULT now()
);

-- 4. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  message    text NOT NULL,
  type       text DEFAULT 'new',  -- 'new' | 'update'
  read       boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- AUTO-NOTIFICATION TRIGGER
-- Fires whenever admin adds or updates a product
-- Inserts a notification row for every non-admin customer
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_customers_on_product_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  notif_msg  text;
  notif_type text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    notif_msg  := 'New item available: ' || NEW.emoji || ' ' || NEW.name || ' — ₹' || NEW.price || '/' || NEW.unit;
    notif_type := 'new';
  ELSE
    notif_msg  := 'Item updated: ' || NEW.emoji || ' ' || NEW.name || ' is now ₹' || NEW.price || '/' || NEW.unit;
    notif_type := 'update';
  END IF;

  INSERT INTO public.notifications (user_id, message, type)
  SELECT id, notif_msg, notif_type
  FROM   public.profiles
  WHERE  is_admin = false;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_change_notify ON public.products;
CREATE TRIGGER product_change_notify
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customers_on_product_change();

-- ============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- PRODUCTS (anyone can read, only admin can write)
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT USING (true);

CREATE POLICY "Admin can insert products"
  ON public.products FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin can update products"
  ON public.products FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

CREATE POLICY "Admin can delete products"
  ON public.products FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- ORDERS
CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin can view all orders"
  ON public.orders FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Allow trigger function to insert notifications (SECURITY DEFINER handles this)

-- ============================================================
-- ENABLE REALTIME for live notification delivery
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- ============================================================
-- MAKE YOURSELF ADMIN
-- After you sign up on the site, run this with YOUR email:
-- UPDATE public.profiles SET is_admin = true WHERE email = 'you@youremail.com';
-- ============================================================
