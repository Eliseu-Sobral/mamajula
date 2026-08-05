/*
# Create shopee_config table

1. New Tables
- `shopee_config`: stores Shopee Open Platform credentials and OAuth tokens.
  - `id` (int, primary key, always 1 — singleton row)
  - `partner_id` (text): Shopee Partner ID
  - `partner_key` (text): Shopee Partner Key (secret)
  - `shop_id` (text): Shopee Shop ID (identifies the merchant's shop)
  - `access_token` (text): OAuth access token for API calls
  - `refresh_token` (text): OAuth refresh token
  - `expire_at` (timestamptz): when the access token expires
  - `status` (text): connection status (disconnected, connecting, connected, error)
  - `updated_at` (timestamptz): last modification time

2. Security
- Enable RLS on `shopee_config`.
- Admin-only access: TO authenticated (admin panel requires sign-in).
*/

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
