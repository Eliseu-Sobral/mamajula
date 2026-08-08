import "jsr:@supabase/functions-js/edge-runtime.d.ts";

/*
 * Secrets obrigatórios (defina via `supabase secrets set` ou painel Supabase):
 *   SUPABASE_SERVICE_ROLE_KEY   — Project Settings → API → service_role key.
 *                                 (Injetado automaticamente pelo Supabase
 *                                 em edge functions implantadas.)
 *
 * Secrets opcionais (recomendados para performance):
 *   JWT_SECRET                  — Project Settings → API → JWT Secret.
 *                                 Se omitido, a função valida os tokens
 *                                 chamando a API /auth/v1/user do próprio
 *                                 Supabase (mais seguro, um pouco mais lento).
 *
 * Secrets opcionais:
 *   SITE_URL          — URL pública da loja (ex: https://mamajula.com.br).
 *                       Usada no link das notificações. Se não definida,
 *                       tenta usar SITE_ORIGIN e, por último, SUPABASE_URL.
 *   SITE_ORIGIN       — CORS allowed origin (default *). Deve ser SITE_URL
 *                       ou um domínio específico em produção.
 */

const BUILD_ID = "2026-08-08-push-deriveBits-v4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "";
const CFG_SITE_ORIGIN = (() => {
  const raw = (Deno.env.get("SITE_ORIGIN") ?? "").trim();
  if (!raw) return "";
  return raw.replace(/\/$/, "");
})();
const SITE_URL = (() => {
  const raw = Deno.env.get("SITE_URL") ?? "";
  if (raw) return raw.replace(/\/$/, "");
  if (CFG_SITE_ORIGIN && CFG_SITE_ORIGIN !== "*") return CFG_SITE_ORIGIN.replace(/\/$/, "");
  return SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, "") : "";
})();

function resolveCorsHeaders(req: Request): Record<string, string> {
  const reqOrigin = (req.headers.get("Origin") ?? "").trim();

  let allowOrigin: string;
  if (CFG_SITE_ORIGIN === "*") {
    allowOrigin = "*";
  } else if (CFG_SITE_ORIGIN && reqOrigin && CFG_SITE_ORIGIN.toLowerCase() === reqOrigin.toLowerCase()) {
    allowOrigin = reqOrigin;
  } else if (reqOrigin) {
    allowOrigin = reqOrigin;
  } else {
    allowOrigin = CFG_SITE_ORIGIN || "*";
  }

  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET, HEAD",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Apikey, X-Client-Info, Accept, Accept-Language, Origin",
    "Access-Control-Expose-Headers": "Content-Type, Content-Length, X-Build-Id, X-Debug-Origin",
    "Access-Control-Max-Age": "10",
    "X-Build-Id": BUILD_ID,
    "X-Debug-Origin": reqOrigin || "(sem header Origin)",
  };
  if (allowOrigin !== "*") headers["Vary"] = "Origin";
  return headers;
}

type PushSub = { id: string; endpoint: string; p256dh: string; auth: string };
type StoreSettings = { vapid_public_key: string; vapid_private_key: string; push_sender_email: string; push_sender_name: string };

function ub64d(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function ub64e(u8: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < u8.byteLength; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64UrlEncodeJson(obj: unknown): string {
  return ub64e(new TextEncoder().encode(JSON.stringify(obj)));
}

async function decodeJwtUnverified(token: string): Promise<{ sub: string; role: string } | null> {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payload = JSON.parse(new TextDecoder().decode(ub64d(payloadB64)));
    return { sub: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

async function verifyJwt(token: string): Promise<boolean> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const [headerB64, payloadB64, sigB64] = parts;
    const sig = ub64d(sigB64);
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const keyData = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JWT_SECRET));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    return await crypto.subtle.verify("HMAC", key, sig, data);
  } catch {
    return false;
  }
}

async function importVapidPrivateKey(rawB64: string): Promise<CryptoKey> {
  const raw = (() => {
    try {
      return ub64d(rawB64);
    } catch {
      /* ignore */
    }
    const pad = "=".repeat((4 - (rawB64.length % 4)) % 4);
    const b = (rawB64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  })();

  const ecAlgo = { name: "ECDSA", namedCurve: "P-256" } as const;

  const attempts: Array<() => Promise<CryptoKey>> = [
    () => crypto.subtle.importKey("pkcs8", raw, ecAlgo, false, ["sign"]),
  ];

  for (const fn of attempts) {
    try {
      return await fn();
    } catch {
      /* keep trying next format */
    }
  }

  throw new Error("Não foi possível importar a chave privada VAPID. Formato esperado: PKCS8 (P-256) em base64url. Vá em Admin → Configurações → Integrações → Push Notifications e clique em 'Gerar novas chaves VAPID'.");
}

async function vapidPrivateToPublicBase64Url(rawB64: string): Promise<string | null> {
  try {
    const priv = await importVapidPrivateKey(rawB64);
    const jwk = await crypto.subtle.exportKey("jwk", priv);
    if (jwk.x && jwk.y) {
      const xBytes = ub64d(jwk.x);
      const yBytes = ub64d(jwk.y);
      const uncompressed = new Uint8Array(1 + xBytes.length + yBytes.length);
      uncompressed[0] = 0x04;
      uncompressed.set(xBytes, 1);
      uncompressed.set(yBytes, 1 + xBytes.length);
      return ub64e(uncompressed);
    }
    return null;
  } catch {
    return null;
  }
}

async function signVapidJwt(privKey: CryptoKey, iss: string, sub: string, aud: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { iss, sub, aud, exp: now + 43200, iat: now };
  const headerB64 = b64UrlEncodeJson(header);
  const payloadB64 = b64UrlEncodeJson(payload);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sigBuf = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privKey, data);
  const sig = new Uint8Array(sigBuf);
  return `${headerB64}.${payloadB64}.${ub64e(sig)}`;
}

async function deriveHkdf(secret: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", secret, { name: "HKDF" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

async function encryptWebPush(payload: Uint8Array, userPublicKeyB64: string, userAuthB64: string): Promise<{ body: Uint8Array; asPublicKey: Uint8Array }> {
  let userPubRaw: Uint8Array;
  let userAuth: Uint8Array;
  try {
    userPubRaw = ub64d(userPublicKeyB64);
    userAuth = ub64d(userAuthB64);
  } catch (e) {
    throw new Error(
      `Inscrição com chaves públicas corrompidas (p256dh/auth não são base64url válidos). ` +
      `Solução: DESATIVE as notificações na home e ATIVE novamente para reinscrever. (${String((e as Error)?.message ?? e).slice(0, 120)})`,
    );
  }

  try {
    if (userPubRaw.length !== 65 || userPubRaw[0] !== 0x04) {
      throw new Error(
        `Chave pública p256dh do usuário tem formato inválido. ` +
        `Esperado 65 bytes com prefixo 0x04 (uncompressed). Recebido ${userPubRaw.length} bytes, primeiro byte=0x${(userPubRaw[0] ?? 0).toString(16)}. ` +
        `Solução: desative e ative novamente as notificações na home.`,
      );
    }
    if (userAuth.length < 12) {
      throw new Error(
        `Auth secret (chave auth) muito curto: ${userAuth.length} bytes. Esperado pelo menos 12 bytes. Solução: reinscrever-se desativando e ativando notificações.`,
      );
    }

    const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]);
    const serverPriv = serverKeys.privateKey;
    const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));

    const userPubKey = await crypto.subtle.importKey("raw", userPubRaw, { name: "ECDH", namedCurve: "P-256" }, false, []);
    const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: userPubKey }, serverPriv, 256));

    const saltInfo = new TextEncoder().encode("WebPush: info\u0000");
    const ikmInfo = new Uint8Array(saltInfo.length + userPubRaw.length + serverPubRaw.length);
    ikmInfo.set(saltInfo, 0);
    ikmInfo.set(userPubRaw, saltInfo.length);
    ikmInfo.set(serverPubRaw, saltInfo.length + userPubRaw.length);
    const ikm = await deriveHkdf(sharedSecret, userAuth, ikmInfo, 32);

    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    const cek = await deriveHkdf(ikm, salt, new TextEncoder().encode("Content-Encoding: aes128gcm\u0000"), 16);
    const nonce = await deriveHkdf(ikm, salt, new TextEncoder().encode("Content-Encoding: nonce\u0000"), 12);

    const paddedPayload = new Uint8Array(payload.length + 1);
    paddedPayload.set(payload, 0);
    paddedPayload[payload.length] = 0x02;

    const cekKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cekKey, paddedPayload));

    const rs = new Uint8Array(4);
    const rsVal = paddedPayload.length + 16;
    rs[0] = (rsVal >>> 24) & 0xff;
    rs[1] = (rsVal >>> 16) & 0xff;
    rs[2] = (rsVal >>> 8) & 0xff;
    rs[3] = rsVal & 0xff;

    const klen = new Uint8Array([serverPubRaw.length]);

    const body = new Uint8Array(16 + 4 + 1 + serverPubRaw.length + ct.length);
    body.set(salt, 0);
    body.set(rs, 16);
    body.set(klen, 20);
    body.set(serverPubRaw, 21);
    body.set(ct, 21 + serverPubRaw.length);

    return { body, asPublicKey: serverPubRaw };
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    if (/usages does not contain|deriveBits|deriveKey|HKDF|ECDH/i.test(m)) {
      throw new Error(
        `Erro de criptografia WebPush (AES128-GCM / ECDH). Causa: ${m.slice(0, 160)}. ` +
        `Solução: desative e ative novamente as notificações na home para reinscrever com chaves novas.`,
      );
    }
    throw e;
  }
}

async function supabaseRest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "apikey": SERVICE_KEY,
    "Authorization": `Bearer ${SERVICE_KEY}`,
    "Prefer": "return=representation",
    ...(init.headers as Record<string, string>),
  };
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, { ...init, headers });
}

Deno.serve(async (req: Request) => {
  const cors = resolveCorsHeaders(req);
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };
  const err = (msg: string, status = 500) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: jsonHeaders });

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...cors, "Content-Length": "0" },
    });
  }

  if (req.method === "GET" || req.method === "HEAD") {
    const url = new URL(req.url);
    if (url.pathname.endsWith("/health") || url.pathname.endsWith("/ping") || url.searchParams.has("ping") || url.searchParams.has("health")) {
      return new Response(
        JSON.stringify({
          ok: true,
          build: BUILD_ID,
          buildDate: "2026-08-08",
          hasFailedEntrySupport: true,
          hasErrorsInResponse: true,
          ecdhDeriveBitsFix: true,
          vapidImportResilient: true,
          cfgSiteOrigin: CFG_SITE_ORIGIN || "(não configurado, usando reflexo)",
          effectiveAllowOrigin: cors["Access-Control-Allow-Origin"] || "",
          requestOrigin: (req.headers.get("Origin") ?? "(sem header Origin)"),
          supabaseUrlSet: !!SUPABASE_URL,
          serviceKeySet: !!SERVICE_KEY,
          jwtSecretSet: !!JWT_SECRET,
          siteUrl: SITE_URL || "(não definido)",
        }),
        { status: 200, headers: jsonHeaders },
      );
    }
    return new Response(
      JSON.stringify({
        error: "Use POST para disparar notificações.",
        hint: "GET /health ou ?ping=1 retorna diagnóstico.",
        build: BUILD_ID,
      }),
      { status: 400, headers: jsonHeaders },
    );
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: jsonHeaders });
  }

  try {
    if (!SERVICE_KEY) return err("SUPABASE_SERVICE_ROLE_KEY não definido nos secrets da edge function.", 500);
    if (!SUPABASE_URL) return err("SUPABASE_URL não definido nos secrets da edge function.", 500);

    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return err("Unauthorized — header Authorization ausente. Faça login no painel admin.", 401);

    const decoded = await decodeJwtUnverified(token);
    if (!decoded) return err("Token JWT inválido — faça login novamente no painel admin.", 401);

    let jwtSignatureOk = false;
    if (JWT_SECRET) {
      try {
        jwtSignatureOk = await verifyJwt(token);
      } catch { jwtSignatureOk = false; }
    }

    if (!jwtSignatureOk && JWT_SECRET) {
      return err(
        `Assinatura do JWT não bate com JWT_SECRET configurado nos secrets da edge function. ` +
        `Copie exatamente o valor de Project Settings → API → JWT Secret e rode: ` +
        `'supabase secrets set JWT_SECRET="cole_aqui_sem_aspas_amarelas"'. ` +
        `Dica: confira se não há espaços extras, quebras de linha nem aspas coladas por engano.`,
        403,
      );
    }

    let supabaseValid = false;
    let supabaseUserRole: string | null = decoded.role ?? null;
    if (!JWT_SECRET || !jwtSignatureOk) {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
          method: "GET",
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${token}`,
          },
        });
        supabaseValid = res.ok;
        if (supabaseValid) {
          try {
            const body = await res.json() as { role?: string };
            supabaseUserRole = body.role ?? "authenticated";
          } catch {
            supabaseUserRole = "authenticated";
          }
        }
      } catch { /* ignore */ }

      if (!supabaseValid && !jwtSignatureOk) {
        return err(
          `Token inválido: tanto a validação local (JWT_SECRET) quanto a validação via Supabase Auth falharam. ` +
          `Soluções: (A) Defina corretamente o JWT_SECRET nos secrets. ` +
          `(B) Faça logout e login novamente no painel admin para obter um token novo. ` +
          `(C) Se estiver rodando localmente, confirme que SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY estão corretos.`,
          403,
        );
      }
    }

    const effectiveRole = (supabaseUserRole ?? decoded.role ?? "") as string;
    if (effectiveRole !== "authenticated" && effectiveRole !== "service_role") {
      return err(
        `Forbidden — token com role '${effectiveRole}'. Só usuários autenticados podem disparar notificações. ` +
        `Faça login no painel admin com sua conta de e-mail/senha.`,
        403,
      );
    }

    const body = await req.json();
    const title: string = body.title ?? "";
    const msgBody: string = body.body ?? "";
    const imageUrl: string | undefined = body.imageUrl;
    const productId: string | undefined = body.productId;

    if (!title || !msgBody) return err("title and body are required", 400);

    const [setsRes, subsRes] = await Promise.all([
      supabaseRest("/store_settings?id=eq.1&select=vapid_public_key,vapid_private_key,push_sender_email,push_sender_name"),
      supabaseRest("/push_subscriptions?select=id,endpoint,p256dh,auth"),
    ]);

    if (!setsRes.ok) {
      const txt = await setsRes.text().catch(() => String(setsRes.status));
      return err(`Falha ao carregar store_settings do Supabase (HTTP ${setsRes.status}). Verifique a tabela e RLS: ${txt.slice(0, 200)}`);
    }
    const settingsArr = await setsRes.json() as StoreSettings[];
    const s = settingsArr[0];
    if (!s || !s.vapid_public_key || !s.vapid_private_key) {
      return err(
        "Chaves VAPID não configuradas. Vá em Admin → Configurações → Integrações → Push Notifications, " +
        "clique em 'Gerar novas chaves VAPID' e depois 'Salvar VAPID'.",
      );
    }

    if (!subsRes.ok) {
      const txt = await subsRes.text().catch(() => String(subsRes.status));
      return err(`Falha ao carregar push_subscriptions do Supabase (HTTP ${subsRes.status}): ${txt.slice(0, 200)}`);
    }
    const subs = await subsRes.json() as PushSub[];

    const senderEmail = s.push_sender_email || "admin@localhost";
    const senderName = s.push_sender_name || "Notificações";

    const vapidPrivKey = await importVapidPrivateKey(s.vapid_private_key);

    const productUrl = productId ? `${SITE_URL}/produto/${productId}` : SITE_URL || "/";
    const landingUrl = SITE_URL || "/";

    const pushPayload = {
      title,
      body: msgBody,
      icon: imageUrl,
      image: imageUrl,
      tag: `n-${Date.now()}`,
      url: productId ? productUrl : landingUrl,
      timestamp: Date.now(),
      requireInteraction: true,
      data: {
        title,
        body: msgBody,
        image: imageUrl,
        url: productId ? productUrl : landingUrl,
        productId,
        senderName,
      },
    };
    const payloadU8 = new TextEncoder().encode(JSON.stringify(pushPayload));

    const jwtCache: Record<string, string> = {};

    let sent = 0;
    let failed = 0;
    const deleteIds: string[] = [];
    const errors: string[] = [];

    const concurrency = 30;
    type FailedEntry = { endpoint: string; err: string };
    const failedDetails: FailedEntry[] = [];

    for (let i = 0; i < subs.length; i += concurrency) {
      const batch = subs.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(async (sub) => {
        try {
          let aud: string;
          try {
            aud = new URL(sub.endpoint).origin;
          } catch {
              throw new Error("Invalid endpoint URL");
          }
          const cacheKey = aud;
          if (!jwtCache[cacheKey]) {
            const subClaim = SITE_URL || new URL(SUPABASE_URL).origin;
            jwtCache[cacheKey] = await signVapidJwt(vapidPrivKey, `mailto:${senderEmail}`, subClaim, aud);
          }
          const vapidToken = jwtCache[cacheKey];

          const { body: encBody } = await encryptWebPush(payloadU8, sub.p256dh, sub.auth);

          const pushRes = await fetch(sub.endpoint, {
            method: "POST",
            headers: {
              "TTL": "60",
              "Urgency": "normal",
              "Authorization": `vapid t=${vapidToken},k=${s.vapid_public_key}`,
              "Content-Encoding": "aes128gcm",
              "Content-Type": "application/octet-stream",
            },
            body: encBody,
          });

          if (pushRes.status === 410) {
            deleteIds.push(sub.id);
            throw new Error(`HTTP 410 Gone — inscrição expirada/inválida (removida)`);
          }
          if (!pushRes.ok) {
            let txt = "";
            try { txt = await pushRes.text(); } catch { /* ignore */ }
            const maskedEndpoint = sub.endpoint.slice(0, 60) + "...";
            throw new Error(`HTTP ${pushRes.status} no endpoint ${maskedEndpoint}${txt ? ": " + txt.slice(0, 200) : ""}`);
          }
          return { ok: true };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          failedDetails.push({ endpoint: sub.endpoint, err: msg });
          return { ok: false };
        }
      }),
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value.ok) sent++;
        else failed++;
      }
    }

    errors.push(...failedDetails.map((f) => `${f.endpoint.slice(0, 80)}: ${f.err}`));

    if (deleteIds.length) {
      const ids = deleteIds.map((id) => `id=eq.${id}`).join(",");
      await supabaseRest(`/push_subscriptions?or=(${ids})`, { method: "DELETE" }).catch(() => {});
    }

    const total = subs.length;
    const status = total === 0 ? "sent" : sent > 0 ? (failed === 0 ? "sent" : "partial") : "failed";
    const errMsg = errors.length ? errors.slice(0, 5).join(" || ") : (total === 0 ? "No subscribers" : null);

    const jobRes = await supabaseRest("/notification_jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Prefer": "return=representation" },
      body: JSON.stringify({
        channel: "push",
        title,
        body: msgBody,
        image_url: imageUrl ?? null,
        product_id: productId ?? null,
        status,
        sent_at: new Date().toISOString(),
        error_message: errMsg,
      }),
    });
    let jobId: string | null = null;
    if (jobRes.ok) {
      const j = await jobRes.json() as Array<{ id?: string }> | { id?: string };
      jobId = Array.isArray(j) ? (j[0]?.id ?? null) : (j.id ?? null);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent,
        failed,
        total,
        jobId,
        errors: failedDetails.slice(0, 10),
        sampleEndpoints: subs.slice(0, 3).map((s) => ({ endpoint: s.endpoint.slice(0, 80), host: new URL(s.endpoint).host })),
      }),
      { headers: jsonHeaders },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), { status: 500, headers: jsonHeaders });
  }
});
