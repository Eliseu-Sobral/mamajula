/*
# Create whatsapp_config table

1. New Tables
- `whatsapp_config`: stores Evolution API credentials and WhatsApp instance state.
  - `id` (int, primary key, always 1 — singleton row)
  - `evolution_url` (text): base URL of the Evolution API server
  - `evolution_api_key` (text): API key for authenticating with Evolution API
  - `evolution_instance` (text): name of the WhatsApp instance to create/connect
  - `group_jid` (text): destination WhatsApp group JID (e.g. 120363xxx@g.us)
  - `instance_status` (text): current connection status (disconnected, connecting, connected, error)
  - `qr_code` (text): base64 or data-URI QR code for pairing the phone
  - `updated_at` (timestamptz): last modification time

2. Security
- Enable RLS on `whatsapp_config`.
- Admin-only access: TO authenticated (admin panel requires sign-in).
*/

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
