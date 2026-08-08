-- Add VAPID keys + push sender info to store_settings singleton

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS vapid_public_key text;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS vapid_private_key text;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS push_sender_email text;
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS push_sender_name text DEFAULT 'Mamajula Perfumaria';

-- RLS policies already exist in initial migration; no changes needed.
