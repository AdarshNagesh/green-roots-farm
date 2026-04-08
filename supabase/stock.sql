-- ============================================================
-- ADARSHINI ORGANIC FARM — Stock Management Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add stock_quantity column to products
-- NULL means unlimited stock (no tracking)
-- Any integer = tracked stock count
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT NULL;

-- ============================================================
-- TRIGGER: Deduct stock when an order is Confirmed
-- Fires on INSERT (COD orders start as Confirmed)
-- and on UPDATE when status changes TO Confirmed (Razorpay)
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_stock_on_confirm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  item        jsonb;
  prod_id     uuid;
  ordered_qty integer;
  current_stock integer;
BEGIN
  -- Only run when status is/becomes 'Confirmed'
  IF NEW.status != 'Confirmed' THEN RETURN NEW; END IF;
  -- On UPDATE, only run when status actually changed to Confirmed
  IF TG_OP = 'UPDATE' AND OLD.status = 'Confirmed' THEN RETURN NEW; END IF;

  -- Loop through each item in the order
  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    prod_id     := (item->>'id')::uuid;
    ordered_qty := (item->>'qty')::integer;

    -- Only process if this product has tracked stock
    SELECT stock_quantity INTO current_stock
    FROM public.products WHERE id = prod_id;

    IF current_stock IS NOT NULL THEN
      -- Deduct ordered quantity
      UPDATE public.products
      SET
        stock_quantity = GREATEST(0, stock_quantity - ordered_qty),
        in_stock       = CASE WHEN GREATEST(0, stock_quantity - ordered_qty) = 0 THEN false ELSE in_stock END,
        updated_at     = now()
      WHERE id = prod_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Drop old trigger if exists, recreate
DROP TRIGGER IF EXISTS deduct_stock_on_order ON public.orders;
CREATE TRIGGER deduct_stock_on_order
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_stock_on_confirm();
