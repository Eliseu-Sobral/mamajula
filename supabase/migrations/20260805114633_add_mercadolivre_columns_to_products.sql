/*
# Add Mercado Livre sync columns to products

1. Modified Tables
- `products`: add two new columns for Mercado Livre marketplace integration
  - `mercadolivre_item_id` (text): the ML item ID returned after publishing
  - `mercadolivre_sync_status` (text): sync status with ML (null, 'pending', 'synced', 'error')

2. Security
- No RLS changes (products table already has RLS enabled).
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS mercadolivre_item_id text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mercadolivre_sync_status text;
