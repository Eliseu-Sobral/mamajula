/*
# Mamajula Initial Schema

## Overview
Creates the full data model for the Mamajula perfume store, including product catalog,
Mercado Livre integration mapping, push notification subscriptions, notification job history,
and orders management.

## New Tables

### categories
Stores product categories (e.g., Perfumes, Body Splash, Cremes, Miniaturas).
- id (uuid, PK)
- name (text, category display name)
- slug (text, URL-friendly identifier)
- image_url (text, category image)
- sort_order (int, display ordering)
- created_at (timestamp)

### products
Core product catalog. Holds all product info for the store, Mercado Livre, and notification dispatch.
- id (uuid, PK)
- name (text, product title)
- description (text)
- category_id (uuid, FK → categories)
- price (numeric, BRL cents stored as decimal)
- original_price (numeric, strike-through price for promotions)
- stock (int)
- images (text[], array of image URLs)
- tags (text[], e.g. ["destaque","econômico","promoção","novidade"])
- status (text: draft | active | inactive)
- featured (boolean)
- ml_category_id (text, Mercado Livre category ID)
- ml_listing_type (text, e.g. gold_special)
- brand (text)
- gtin (text, barcode when applicable)
- weight_kg (numeric, for shipping calculation)
- variations (jsonb, array of {name, options} for volume variants)
- created_at, updated_at (timestamp)

### product_ml_mapping
Tracks the sync state between a Mamajula product and its Mercado Livre listing.
- id (uuid, PK)
- product_id (uuid, FK → products)
- ml_item_id (text, e.g. MLB12345678)
- ml_status (text: pending | published | paused | error)
- ml_permalink (text, public ML listing URL)
- last_synced_at (timestamp)
- error_message (text)
- created_at, updated_at (timestamp)

### push_subscriptions
Web Push (VAPID) subscription objects stored per subscriber endpoint.
- id (uuid, PK)
- endpoint (text, UNIQUE — the push service URL)
- p256dh (text, encryption key)
- auth (text, auth secret)
- user_agent (text, optional)
- created_at (timestamp)

### notification_jobs
Audit log and retry queue for every push notification and WhatsApp message dispatched.
- id (uuid, PK)
- channel (text: push | whatsapp)
- product_id (uuid, FK → products, nullable for manual messages)
- title (text)
- body (text)
- image_url (text)
- status (text: pending | sent | failed)
- error_message (text)
- sent_at (timestamp)
- created_at (timestamp)

### orders
Orders placed on the store. Conciliation with ML orders is a future concern.
- id (uuid, PK)
- customer_name, customer_email, customer_phone (text)
- shipping_address (jsonb)
- items (jsonb, snapshot of ordered items with prices)
- subtotal, shipping_cost, total (numeric)
- status (text: pending | confirmed | shipped | delivered | cancelled)
- payment_method (text)
- notes (text)
- created_at, updated_at (timestamp)

## Security
All tables use RLS. Because there is no customer login in v1 (admin-only auth), public
tables (products, categories) allow anon SELECT for the storefront. Write operations on
admin tables (products, categories, notification_jobs, push_subscriptions, ml_mapping)
are restricted to authenticated users (admin). Orders can be inserted by anon (checkout)
but only read by authenticated.
*/

-- ==================== CATEGORIES ====================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_categories" ON categories;
CREATE POLICY "auth_insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_categories" ON categories;
CREATE POLICY "auth_update_categories" ON categories FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_categories" ON categories;
CREATE POLICY "auth_delete_categories" ON categories FOR DELETE
  TO authenticated USING (true);

-- ==================== PRODUCTS ====================
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  original_price numeric(10,2),
  stock int NOT NULL DEFAULT 0,
  images text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','inactive')),
  featured boolean NOT NULL DEFAULT false,
  ml_category_id text,
  ml_listing_type text DEFAULT 'gold_special',
  brand text,
  gtin text,
  weight_kg numeric(6,3),
  variations jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_category_idx ON products(category_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products(status);
CREATE INDEX IF NOT EXISTS products_featured_idx ON products(featured);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_products" ON products;
CREATE POLICY "auth_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_products" ON products;
CREATE POLICY "auth_update_products" ON products FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_products" ON products;
CREATE POLICY "auth_delete_products" ON products FOR DELETE
  TO authenticated USING (true);

-- auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== PRODUCT ML MAPPING ====================
CREATE TABLE IF NOT EXISTS product_ml_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  ml_item_id text,
  ml_status text NOT NULL DEFAULT 'pending' CHECK (ml_status IN ('pending','published','paused','error')),
  ml_permalink text,
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_ml_mapping_product_idx ON product_ml_mapping(product_id);

ALTER TABLE product_ml_mapping ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_select_ml_mapping" ON product_ml_mapping;
CREATE POLICY "auth_select_ml_mapping" ON product_ml_mapping FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_ml_mapping" ON product_ml_mapping;
CREATE POLICY "auth_insert_ml_mapping" ON product_ml_mapping FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_ml_mapping" ON product_ml_mapping;
CREATE POLICY "auth_update_ml_mapping" ON product_ml_mapping FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_ml_mapping" ON product_ml_mapping;
CREATE POLICY "auth_delete_ml_mapping" ON product_ml_mapping FOR DELETE
  TO authenticated USING (true);

DROP TRIGGER IF EXISTS product_ml_mapping_updated_at ON product_ml_mapping;
CREATE TRIGGER product_ml_mapping_updated_at
  BEFORE UPDATE ON product_ml_mapping
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== PUSH SUBSCRIPTIONS ====================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_push_sub" ON push_subscriptions;
CREATE POLICY "anon_insert_push_sub" ON push_subscriptions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_push_sub" ON push_subscriptions;
CREATE POLICY "auth_select_push_sub" ON push_subscriptions FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_delete_push_sub" ON push_subscriptions;
CREATE POLICY "auth_delete_push_sub" ON push_subscriptions FOR DELETE
  TO authenticated USING (true);

-- ==================== NOTIFICATION JOBS ====================
CREATE TABLE IF NOT EXISTS notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('push','whatsapp')),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_jobs_status_idx ON notification_jobs(status);
CREATE INDEX IF NOT EXISTS notification_jobs_channel_idx ON notification_jobs(channel);

ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_notification_jobs" ON notification_jobs;
CREATE POLICY "auth_select_notification_jobs" ON notification_jobs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_notification_jobs" ON notification_jobs;
CREATE POLICY "auth_insert_notification_jobs" ON notification_jobs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_notification_jobs" ON notification_jobs;
CREATE POLICY "auth_update_notification_jobs" ON notification_jobs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_notification_jobs" ON notification_jobs;
CREATE POLICY "auth_delete_notification_jobs" ON notification_jobs FOR DELETE
  TO authenticated USING (true);

-- ==================== ORDERS ====================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  shipping_address jsonb NOT NULL DEFAULT '{}',
  items jsonb NOT NULL DEFAULT '[]',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  payment_method text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_select_orders" ON orders;
CREATE POLICY "auth_select_orders" ON orders FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "auth_update_orders" ON orders;
CREATE POLICY "auth_update_orders" ON orders FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== SEED CATEGORIES ====================
INSERT INTO categories (name, slug, image_url, sort_order) VALUES
  ('Perfumes', 'perfumes', 'https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg', 1),
  ('Body Splash', 'body-splash', 'https://images.pexels.com/photos/3685530/pexels-photo-3685530.jpeg', 2),
  ('Cremes', 'cremes', 'https://images.pexels.com/photos/6621462/pexels-photo-6621462.jpeg', 3),
  ('Miniaturas', 'miniaturas', 'https://images.pexels.com/photos/3737594/pexels-photo-3737594.jpeg', 4),
  ('Originais Árabes', 'arabes', 'https://images.pexels.com/photos/1001850/pexels-photo-1001850.jpeg', 5),
  ('Importados', 'importados', 'https://images.pexels.com/photos/3270224/pexels-photo-3270224.jpeg', 6)
ON CONFLICT (slug) DO NOTHING;
