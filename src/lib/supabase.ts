import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
} else {
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Create a .env file in the project root with both variables. ' +
    'Supabase features will be unavailable until configured.',
  );
}

export const supabase = supabaseInstance as SupabaseClient;

export type Category = {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  sort_order: number;
  created_at: string;
};

export type ProductVariation = { name: string; options: string[] };

export type Product = {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  images: string[];
  tags: string[];
  status: 'draft' | 'active' | 'inactive';
  featured: boolean;
  ml_category_id: string | null;
  ml_listing_type: string;
  brand: string | null;
  gtin: string | null;
  weight_kg: number | null;
  variations: ProductVariation[] | null;
  shopee_item_id: string | null;
  shopee_sync_status: 'pending' | 'synced' | 'error' | null;
  mercadolivre_item_id: string | null;
  mercadolivre_sync_status: 'pending' | 'synced' | 'error' | null;
  created_at: string;
  updated_at: string;
};

export type ProductWithCategory = Product & { category: Category | null };

export type NotificationJob = {
  id: string;
  channel: 'push' | 'whatsapp';
  product_id: string | null;
  title: string;
  body: string;
  image_url: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: Record<string, unknown>;
  items: Array<{ id: string; name: string; price: number; qty: number; image?: string }>;
  subtotal: number;
  shipping_cost: number;
  total: number;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};
