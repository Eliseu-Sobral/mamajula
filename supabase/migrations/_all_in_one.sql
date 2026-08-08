-- ============================================================
-- MAMAJULA - TODAS AS MIGRATIONS CONSOLIDADAS
-- Copie TODO este arquivo, cole no SQL Editor do Supabase
-- (https://app.supabase.com/project/ytvrtrozkkjsuofevyab/sql/new)
-- e clique em "Run".
-- ============================================================

-- ==================== 1) CATEGORIES ====================
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

-- ==================== 2) PRODUCTS ====================
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
  shopee_item_id text,
  shopee_sync_status text,
  mercadolivre_item_id text,
  mercadolivre_sync_status text,
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

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== 3) PRODUCT ML MAPPING ====================
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

-- ==================== 4) PUSH SUBSCRIPTIONS ====================
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

DROP POLICY IF EXISTS "self_unsubscribe_push_sub" ON push_subscriptions;
CREATE POLICY "self_unsubscribe_push_sub" ON push_subscriptions FOR DELETE
  TO anon, authenticated USING (true);

-- ==================== 5) NOTIFICATION JOBS ====================
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

DROP POLICY IF EXISTS "auth_select_notification_jobs" ON notification_jobs;
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

-- ==================== 6) ORDERS ====================
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

-- ==================== 7) WHATSAPP CONFIG ====================
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id int PRIMARY KEY DEFAULT 1,
  evolution_url text,
  evolution_api_key text,
  evolution_instance text,
  group_jid text,
  instance_status text DEFAULT 'disconnected',
  qr_code text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_whatsapp_config" ON whatsapp_config;
CREATE POLICY "select_whatsapp_config" ON whatsapp_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_whatsapp_config" ON whatsapp_config;
CREATE POLICY "insert_whatsapp_config" ON whatsapp_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_whatsapp_config" ON whatsapp_config;
CREATE POLICY "update_whatsapp_config" ON whatsapp_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_whatsapp_config" ON whatsapp_config;
CREATE POLICY "delete_whatsapp_config" ON whatsapp_config FOR DELETE
  TO authenticated USING (true);

-- ==================== 8) SHOPEE CONFIG ====================
CREATE TABLE IF NOT EXISTS shopee_config (
  id int PRIMARY KEY DEFAULT 1,
  partner_id text,
  partner_key text,
  shop_id text,
  access_token text,
  refresh_token text,
  expire_at timestamptz,
  status text DEFAULT 'disconnected',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE shopee_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_shopee_config" ON shopee_config;
CREATE POLICY "select_shopee_config" ON shopee_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_shopee_config" ON shopee_config;
CREATE POLICY "insert_shopee_config" ON shopee_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_shopee_config" ON shopee_config;
CREATE POLICY "update_shopee_config" ON shopee_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_shopee_config" ON shopee_config;
CREATE POLICY "delete_shopee_config" ON shopee_config FOR DELETE
  TO authenticated USING (true);

-- ==================== 9) MERCADO LIVRE CONFIG ====================
CREATE TABLE IF NOT EXISTS mercadolivre_config (
  id int PRIMARY KEY DEFAULT 1,
  app_id text,
  client_secret text,
  access_token text,
  refresh_token text,
  ml_user_id text,
  expire_at timestamptz,
  status text DEFAULT 'disconnected',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mercadolivre_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_mercadolivre_config" ON mercadolivre_config;
CREATE POLICY "select_mercadolivre_config" ON mercadolivre_config FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_mercadolivre_config" ON mercadolivre_config;
CREATE POLICY "insert_mercadolivre_config" ON mercadolivre_config FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_mercadolivre_config" ON mercadolivre_config;
CREATE POLICY "update_mercadolivre_config" ON mercadolivre_config FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_mercadolivre_config" ON mercadolivre_config;
CREATE POLICY "delete_mercadolivre_config" ON mercadolivre_config FOR DELETE
  TO authenticated USING (true);

-- ==================== 10) STORE SETTINGS ====================
CREATE TABLE IF NOT EXISTS store_settings (
  id int PRIMARY KEY DEFAULT 1,
  contact_phone text,
  vapid_public_key text,
  vapid_private_key text,
  push_sender_email text,
  push_sender_name text DEFAULT 'Mamajula Perfumaria',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_store_settings" ON store_settings;
CREATE POLICY "anon_select_store_settings" ON store_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_store_settings" ON store_settings;
CREATE POLICY "auth_insert_store_settings" ON store_settings FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "auth_update_store_settings" ON store_settings;
CREATE POLICY "auth_update_store_settings" ON store_settings FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_delete_store_settings" ON store_settings;
CREATE POLICY "auth_delete_store_settings" ON store_settings FOR DELETE
  TO authenticated USING (true);

INSERT INTO store_settings (id, contact_phone) VALUES (1, '')
ON CONFLICT (id) DO NOTHING;

-- ==================== 11) SEED CATEGORIES ====================
INSERT INTO categories (name, slug, image_url, sort_order) VALUES
  ('Perfumes', 'perfumes', 'https://images.pexels.com/photos/965989/pexels-photo-965989.jpeg', 1),
  ('Body Splash', 'body-splash', 'https://images.pexels.com/photos/3685530/pexels-photo-3685530.jpeg', 2),
  ('Cremes', 'cremes', 'https://images.pexels.com/photos/6621462/pexels-photo-6621462.jpeg', 3),
  ('Miniaturas', 'miniaturas', 'https://images.pexels.com/photos/3737594/pexels-photo-3737594.jpeg', 4),
  ('Originais Árabes', 'arabes', 'https://images.pexels.com/photos/1001850/pexels-photo-1001850.jpeg', 5),
  ('Importados', 'importados', 'https://images.pexels.com/photos/3270224/pexels-photo-3270224.jpeg', 6)
ON CONFLICT (slug) DO NOTHING;
