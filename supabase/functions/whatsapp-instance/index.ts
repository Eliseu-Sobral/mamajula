import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

async function getConfig() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_config?id=eq.1`, {
    headers: {
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
    },
  });
  const data = await res.json();
  return data[0] ?? null;
}

async function upsertConfig(patch: Record<string, unknown>) {
  const existing = await getConfig();
  const body = {
    id: 1,
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_config?id=eq.1`, {
      method: "PATCH",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify(patch),
    });
    return await res.json();
  } else {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_config`, {
      method: "POST",
      headers: {
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      },
      body: JSON.stringify(body),
    });
    return await res.json();
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";
    const body = req.method === "POST" || req.method === "PUT" ? await req.json().catch(() => ({})) : {};

    // SAVE: store Evolution API credentials in the database
    if (action === "save") {
      const { evolution_url, evolution_api_key, evolution_instance, group_jid } = body;
      await upsertConfig({
        evolution_url,
        evolution_api_key,
        evolution_instance,
        group_jid,
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LOAD: return current config (without exposing the API key)
    if (action === "load") {
      const config = await getConfig();
      if (!config) {
        return new Response(JSON.stringify({ config: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        config: {
          evolution_url: config.evolution_url,
          evolution_api_key: config.evolution_api_key ? "••••••" : "",
          evolution_instance: config.evolution_instance,
          group_jid: config.group_jid,
          instance_status: config.instance_status,
          qr_code: config.qr_code,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For all other actions, we need the config
    const config = await getConfig();
    if (!config || !config.evolution_url || !config.evolution_api_key || !config.evolution_instance) {
      return new Response(JSON.stringify({ error: "Evolution API não configurada. Salve as credenciais primeiro." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = config.evolution_url.replace(/\/$/, "");
    const apiKey = config.evolution_api_key;
    const instance = config.evolution_instance;

    // CREATE: create a new WhatsApp instance in Evolution API
    if (action === "create") {
      const res = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey,
        },
        body: JSON.stringify({
          instanceName: instance,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Instance may already exist — try to fetch its connection state
        if (data.message?.includes?.("already") || res.status === 409) {
          await upsertConfig({ instance_status: "connecting" });
          return new Response(JSON.stringify({ success: true, message: "Instância já existe. Solicite o QR code.", data }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ error: data.message || data.error || "Erro ao criar instância" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract QR code if present in the create response
      const qr = data.qrcode?.code || data.qrcode?.base64 || data.base64 || null;
      await upsertConfig({ instance_status: "connecting", qr_code: qr });

      return new Response(JSON.stringify({ success: true, qr_code: qr, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // QR: fetch the QR code to pair the phone
    if (action === "qr") {
      const res = await fetch(`${baseUrl}/instance/connect/${instance}`, {
        method: "GET",
        headers: { "apikey": apiKey },
      });

      const data = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message || data.error || "Erro ao obter QR code" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const qr = data.code || data.base64 || data.qrcode?.code || data.qrcode?.base64 || null;
      const status = data.status || data.state || "connecting";
      await upsertConfig({ qr_code: qr, instance_status: status === "open" ? "connected" : "connecting" });

      return new Response(JSON.stringify({ success: true, qr_code: qr, status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // STATUS: check the connection status of the instance
    if (action === "status") {
      const res = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        method: "GET",
        headers: { "apikey": apiKey },
      });

      const data = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message || data.error || "Erro ao verificar status" }), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = data.instance?.state || data.state || "disconnected";
      const status = state === "open" ? "connected" : state === "close" ? "disconnected" : "connecting";
      await upsertConfig({ instance_status: status });

      return new Response(JSON.stringify({ success: true, status, state }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE: logout and delete the instance
    if (action === "delete") {
      await fetch(`${baseUrl}/instance/logout/${instance}`, {
        method: "DELETE",
        headers: { "apikey": apiKey },
      }).catch(() => {});

      await fetch(`${baseUrl}/instance/delete/${instance}`, {
        method: "DELETE",
        headers: { "apikey": apiKey },
      }).catch(() => {});

      await upsertConfig({ instance_status: "disconnected", qr_code: null });

      return new Response(JSON.stringify({ success: true, message: "Instância removida" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida. Use: save, load, create, qr, status, delete." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
