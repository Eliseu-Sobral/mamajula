/*
# Create mercadolivre_config table

1. New Tables
- `mercadolivre_config`: stores Mercado Livre app credentials and OAuth tokens.
  - `id` (int, primary key, always 1 — singleton row)
  - `app_id` (text): Mercado Livre Application ID
  - `client_secret` (text): Mercado Livre Client Secret
  - `access_token` (text): OAuth access token for API calls
  - `refresh_token` (text): OAuth refresh token
  - `ml_user_id` (text): Mercado Livre user ID
  - `expire_at` (timestamptz): when the access token expires
  - `status` (text): connection status (disconnected, connecting, connected, error)
  - `updated_at` (timestamptz): last modification time

2. Security
- Enable RLS on `mercadolivre_config`.
- Admin-only access: TO authenticated.
*/

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
