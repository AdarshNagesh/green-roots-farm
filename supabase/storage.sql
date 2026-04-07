-- ============================================================
-- GREEN ROOTS FARM — Storage Setup for Product Images
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add image_url column to products (safe to run on existing table)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to VIEW images (public bucket)
CREATE POLICY "Public can view product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Allow only admin to UPLOAD images
CREATE POLICY "Admin can upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

-- Allow only admin to UPDATE images
CREATE POLICY "Admin can update product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );

-- Allow only admin to DELETE images
CREATE POLICY "Admin can delete product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND public.is_admin()
  );
