import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SHOPEE_API = "https://partner.shopeemobile.com/api/v2";

async function getConfig() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/shopee_config?id=eq.1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const data = await res.json();
  return data[0] ?? null;
}

async function upsertConfig(patch: Record<string, unknown>) {
  const body = { id: 1, ...patch, updated_at: new Date().toISOString() };
  const existing = await getConfig();
  if (existing) {
    await fetch(`${SUPABASE_URL}/rest/v1/shopee_config?id=eq.1`, {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/shopee_config`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
}

async function updateProduct(productId: string, patch: Record<string, unknown>) {
  await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${productId}`, {
    method: "PATCH",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
}

function sign(path: string, partnerId: string, partnerKey: string, ts: number): string {
  // Shopee signature: HMAC-SHA256 of partner_id + path + timestamp, keyed by partner_key
  const message = `${partnerId}${path}${ts}`;
  const key = new TextEncoder().encode(partnerKey);
  const msg = new TextEncoder().encode(message);
  const crypto = globalThis.crypto;
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((k) => crypto.subtle.sign("HMAC", k, msg))
    .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // SAVE: store Shopee Partner credentials
    if (action === "save") {
      const { partner_id, partner_key, shop_id } = body;
      await upsertConfig({ partner_id, partner_key, shop_id, status: "disconnected" });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LOAD: return current config (mask sensitive fields)
    if (action === "load") {
      const config = await getConfig();
      if (!config) {
        return new Response(JSON.stringify({ config: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        config: {
          partner_id: config.partner_id,
          partner_key: config.partner_key ? "••••••" : "",
          shop_id: config.shop_id,
          status: config.status,
          expire_at: config.expire_at,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AUTH_URL: generate the Shopee authorization URL for the merchant to approve
    if (action === "auth_url") {
      const config = await getConfig();
      if (!config || !config.partner_id || !config.partner_key) {
        return new Response(JSON.stringify({ error: "Configure o Partner ID e Partner Key primeiro." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ts = Math.floor(Date.now() / 1000);
      const path = "/api/v2/shop/auth_partner";
      const signStr = await sign(path, config.partner_id, config.partner_key, ts);
      const host = config.shop_id
        ? `${SHOPEE_API}/shop/auth_partner?partner_id=${config.partner_id}&timestamp=${ts}&sign=${signStr}&redirect=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/shopee-sync?action=callback`)}`
        : `${SHOPEE_API}/shop/auth_partner?partner_id=${config.partner_id}&timestamp=${ts}&sign=${signStr}&redirect=${encodeURIComponent(`${SUPABASE_URL}/functions/v1/shopee-sync?action=callback`)}`;
      return new Response(JSON.stringify({ success: true, auth_url: host }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CALLBACK: OAuth callback — exchange code for access token
    if (action === "callback") {
      const config = await getConfig();
      if (!config) {
        return new Response(JSON.stringify({ error: "Config não encontrada" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const code = url.searchParams.get("code");
      const shopId = url.searchParams.get("shop_id");
      if (!code || !shopId) {
        return new Response(JSON.stringify({ error: "Parâmetros de callback ausentes" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const ts = Math.floor(Date.now() / 1000);
      const path = "/api/v2/auth/token/get";
      const signStr = await sign(path, config.partner_id, config.partner_key, ts);
      const tokenRes = await fetch(`${SHOPEE_API}/auth/token/get?partner_id=${config.partner_id}&timestamp=${ts}&sign=${signStr}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, shop_id: parseInt(shopId), partner_id: parseInt(config.partner_id) }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        await upsertConfig({ status: "error" });
        return new Response(JSON.stringify({ error: tokenData.error || tokenData.message || "Erro ao obter token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expireAt = new Date(Date.now() + (tokenData.expire_in ?? 14400) * 1000).toISOString();
      await upsertConfig({
        shop_id: shopId,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expire_at: expireAt,
        status: "connected",
      });
      return new Response(JSON.stringify({ success: true, message: "Shopee conectado com sucesso!" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STATUS: check connection status
    if (action === "status") {
      const config = await getConfig();
      if (!config) {
        return new Response(JSON.stringify({ status: "disconnected" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isExpired = config.expire_at && new Date(config.expire_at) < new Date();
      const status = config.access_token && !isExpired ? "connected" : config.status || "disconnected";
      return new Response(JSON.stringify({ success: true, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DISCONNECT: clear tokens
    if (action === "disconnect") {
      await upsertConfig({ access_token: null, refresh_token: null, expire_at: null, status: "disconnected" });
      return new Response(JSON.stringify({ success: true, message: "Desconectado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUSH_PRODUCT: publish or update a product on Shopee
    if (action === "push_product") {
      const config = await getConfig();
      if (!config || !config.access_token) {
        return new Response(JSON.stringify({ error: "Shopee não conectado. Autorize a conta primeiro." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { product_id } = body;
      // Fetch the product from Supabase
      const prodRes = await fetch(`${SUPABASE_URL}/rest/v1/products?id=eq.${product_id}&select=*`, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
      });
      const prodData = await prodRes.json();
      const product = prodData[0];
      if (!product) {
        return new Response(JSON.stringify({ error: "Produto não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ts = Math.floor(Date.now() / 1000);
      const shopId = config.shop_id;
      const partnerId = config.partner_id;
      const partnerKey = config.partner_key;
      const accessToken = config.access_token;

      // Build the Shopee product payload
      const shopeePayload = {
        item_name: product.name,
        description: product.description || product.name,
        price: Math.round((product.price / 100) * 100000), // Shopee uses cents
        stock: product.stock || 0,
        item_status: "NORMAL",
        logistic_info: [{ logistic_id: "RPSI" }], // Default shipping
        weight: 0.5, // kg — default
        product_attrs: {},
        images: (product.images || []).slice(0, 9).map((url: string) => ({ url })),
        attributes: [],
        category_id: 0, // Would need category mapping
      };

      // Sign the request
      const path = "/api/v2/product/add_item";
      const signStr = await sign(path, partnerId, partnerKey, ts);
      const apiUrl = `${SHOPEE_API}/product/add_item?partner_id=${partnerId}&shopid=${shopId}&access_token=${accessToken}&sign=${signStr}&timestamp=${ts}`;

      const pushRes = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shopeePayload),
      });
      const pushData = await pushRes.json();

      if (!pushRes.ok || pushData.error) {
        await updateProduct(product_id, { shopee_sync_status: "error" });
        return new Response(JSON.stringify({ error: pushData.error || pushData.message || "Erro ao publicar na Shopee" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const shopeeItemId = pushData.item_id?.toString() ?? null;
      await updateProduct(product_id, {
        shopee_item_id: shopeeItemId,
        shopee_sync_status: "synced",
      });

      return new Response(JSON.stringify({ success: true, shopee_item_id: shopeeItemId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use: save, load, auth_url, callback, status, disconnect, push_product." }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
