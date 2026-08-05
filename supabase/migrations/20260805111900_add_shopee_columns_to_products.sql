/*
# Add Shopee sync columns to products

1. Modified Tables
- `products`: add two new columns for Shopee marketplace integration
  - `shopee_item_id` (text): the Shopee product item ID returned after publishing
  - `shopee_sync_status` (text): sync status with Shopee (null, 'pending', 'synced', 'error')

2. Security
- No RLS changes (products table already has RLS enabled).
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS shopee_item_id text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shopee_sync_status text;
