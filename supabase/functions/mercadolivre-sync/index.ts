import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Mercado Livre API — Brazilian site (MLB). For other countries, change the domain.
const ML_API = "https://api.mercadolibre.com";
const ML_AUTH = "https://auth.mercadolivre.com.br";

async function getConfig() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/mercadolivre_config?id=eq.1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const data = await res.json();
  return data[0] ?? null;
}

async function upsertConfig(patch: Record<string, unknown>) {
  const existing = await getConfig();
  if (existing) {
    await fetch(`${SUPABASE_URL}/rest/v1/mercadolivre_config?id=eq.1`, {
      method: "PATCH",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    });
  } else {
    await fetch(`${SUPABASE_URL}/rest/v1/mercadolivre_config`, {
      method: "POST",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id: 1, ...patch, updated_at: new Date().toISOString() }),
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

async function refreshTokenIfNeeded(config: Record<string, any>): Promise<Record<string, any>> {
  const isExpired = config.expire_at && new Date(config.expire_at) < new Date(Date.now() + 60_000);
  if (!isExpired || !config.refresh_token) return config;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.app_id,
    client_secret: config.client_secret,
    refresh_token: config.refresh_token,
  });

  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || data.message || "Erro ao renovar token ML");

  const expireAt = new Date(Date.now() + (data.expires_in ?? 21600) * 1000).toISOString();
  await upsertConfig({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    ml_user_id: data.user_id?.toString() ?? config.ml_user_id,
    expire_at: expireAt,
  });

  return { ...config, access_token: data.access_token, refresh_token: data.refresh_token, expire_at: expireAt };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    // SAVE: store ML app credentials
    if (action === "save") {
      const { app_id, client_secret } = body;
      await upsertConfig({ app_id, client_secret, status: "disconnected" });
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
          app_id: config.app_id,
          client_secret: config.client_secret ? "••••••" : "",
          ml_user_id: config.ml_user_id,
          status: config.status,
          expire_at: config.expire_at,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AUTH_URL: generate the ML authorization URL
    if (action === "auth_url") {
      const config = await getConfig();
      if (!config || !config.app_id) {
        return new Response(JSON.stringify({ error: "Configure o App ID e Client Secret primeiro." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const redirectUri = `${SUPABASE_URL}/functions/v1/mercadolivre-sync?action=callback`;
      const authUrl = `${ML_AUTH}/authorization?response_type=code&client_id=${config.app_id}&redirect_uri=${encodeURIComponent(redirectUri)}`;
      return new Response(JSON.stringify({ success: true, auth_url: authUrl }), {
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
      if (!code) {
        return new Response(JSON.stringify({ error: "Código de autorização ausente" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const redirectUri = `${SUPABASE_URL}/functions/v1/mercadolivre-sync?action=callback`;
      const tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.app_id,
        client_secret: config.client_secret,
        code,
        redirect_uri: redirectUri,
      });
      const tokenRes = await fetch(`${ML_API}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok || tokenData.error) {
        await upsertConfig({ status: "error" });
        return new Response(JSON.stringify({ error: tokenData.error || tokenData.message || "Erro ao obter token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const expireAt = new Date(Date.now() + (tokenData.expires_in ?? 21600) * 1000).toISOString();
      await upsertConfig({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        ml_user_id: tokenData.user_id?.toString() ?? null,
        expire_at: expireAt,
        status: "connected",
      });
      return new Response(JSON.stringify({ success: true, message: "Mercado Livre conectado com sucesso!" }), {
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
      await upsertConfig({ access_token: null, refresh_token: null, ml_user_id: null, expire_at: null, status: "disconnected" });
      return new Response(JSON.stringify({ success: true, message: "Desconectado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUSH_PRODUCT: publish or update a product on Mercado Livre
    if (action === "push_product") {
      let config = await getConfig();
      if (!config || !config.access_token) {
        return new Response(JSON.stringify({ error: "Mercado Livre não conectado. Autorize a conta primeiro." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Refresh token if needed
      config = await refreshTokenIfNeeded(config);

      const { product_id } = body;
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

      // Build the ML item payload
      const mlPayload: Record<string, unknown> = {
        title: product.name,
        description: { plain_text: product.description || product.name },
        price: Number((product.price / 100).toFixed(2)),
        currency_id: "BRL",
        available_quantity: product.stock || 1,
        buying_mode: "buy_it_now",
        condition: "new",
        listing_type_id: "gold_special",
        shipping: {
          mode: "me2",
          local_pick_up: false,
          free_shipping: false,
        },
        pictures: (product.images || []).slice(0, 6).map((url: string) => ({ source: url })),
      };

      // If the product already has an ML item ID, update it; otherwise create a new one
      const itemId = product.mercadolivre_item_id;
      const apiUrl = itemId ? `${ML_API}/items/${itemId}?access_token=${config.access_token}` : `${ML_API}/items?access_token=${config.access_token}`;
      const method = itemId ? "PUT" : "POST";

      const pushRes = await fetch(apiUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mlPayload),
      });
      const pushData = await pushRes.json();

      if (!pushRes.ok || pushData.error) {
        await updateProduct(product_id, { mercadolivre_sync_status: "error" });
        const errMsg = pushData.message || pushData.cause?.map((c: any) => c.message).join("; ") || "Erro ao publicar no Mercado Livre";
        return new Response(JSON.stringify({ error: errMsg }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const mlItemId = pushData.id ?? itemId;
      await updateProduct(product_id, {
        mercadolivre_item_id: mlItemId,
        mercadolivre_sync_status: "synced",
      });

      return new Response(JSON.stringify({ success: true, mercadolivre_item_id: mlItemId }), {
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
