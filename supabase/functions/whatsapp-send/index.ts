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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { title, message, imageUrl, productUrl, productId } = body;

    if (!title || !message) {
      return new Response(
        JSON.stringify({ error: "title and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const config = await getConfig();

    if (!config || !config.evolution_url || !config.evolution_api_key || !config.evolution_instance || !config.group_jid) {
      return new Response(
        JSON.stringify({ error: "Evolution API não configurada. Configure as credenciais no painel administrativo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (config.instance_status !== "connected") {
      return new Response(
        JSON.stringify({ error: "WhatsApp não conectado. Escaneie o QR code no painel para conectar." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const baseUrl = config.evolution_url.replace(/\/$/, "");
    const apiKey = config.evolution_api_key;
    const instance = config.evolution_instance;
    const groupJid = config.group_jid;

    // Format the WhatsApp message
    let text = `*${title}*\n\n${message}`;
    if (productUrl) {
      text += `\n\n🛍️ ${productUrl}`;
    }

    // Build Evolution API payload
    const payload: Record<string, unknown> = {
      number: groupJid,
      textMessage: { text },
    };

    let endpoint = "/message/sendText";
    if (imageUrl) {
      endpoint = "/message/sendMedia";
      payload.mediaMessage = {
        mediatype: "image",
        media: imageUrl,
        caption: text,
      };
      payload.textMessage = undefined;
    }

    const apiUrl = `${baseUrl}/instance/${instance}${endpoint}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Evolution API error (${response.status}): ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await response.json();

    // Record the job in notification_jobs table
    if (SUPABASE_URL && SERVICE_KEY) {
      await fetch(`${SUPABASE_URL}/rest/v1/notification_jobs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SERVICE_KEY,
          "Authorization": `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({
          channel: "whatsapp",
          product_id: productId ?? null,
          title,
          body: message,
          image_url: imageUrl ?? null,
          status: "sent",
          sent_at: new Date().toISOString(),
        }),
      });
    }

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
