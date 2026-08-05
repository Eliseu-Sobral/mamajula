/*
# Create store_settings table

1. New Tables
- `store_settings`: singleton table (id = 1) for storefront-level configuration.
  - `id` (int, PK, always 1)
  - `contact_phone` (text): WhatsApp phone number in international format (e.g. 5511999999999)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `store_settings`.
- anon + authenticated SELECT so the storefront can read the phone number.
- authenticated-only INSERT/UPDATE/DELETE so only admins can change it.
*/

CREATE TABLE IF NOT EXISTS store_settings (
  id int PRIMARY KEY DEFAULT 1,
  contact_phone text,
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

-- Seed a default row
INSERT INTO store_settings (id, contact_phone) VALUES (1, '')
ON CONFLICT (id) DO NOTHING;
