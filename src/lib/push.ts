import { supabase } from '@/lib/supabase';

export type PushConfig = {
  vapidPublicKey: string;
  senderEmail?: string;
  senderName?: string;
};

export type PushSubscriptionJSON = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function loadPushConfig(): Promise<PushConfig | null> {
  try {
    const envPub = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) || '';
    if (envPub) {
      return {
        vapidPublicKey: envPub,
        senderEmail: (import.meta.env.VITE_PUSH_SENDER_EMAIL as string) || undefined,
        senderName: (import.meta.env.VITE_PUSH_SENDER_NAME as string) || undefined,
      };
    }
    const { data, error } = await supabase
      .from('store_settings')
      .select('vapid_public_key, push_sender_email, push_sender_name')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) return null;
    if (!data.vapid_public_key) return null;
    return {
      vapidPublicKey: data.vapid_public_key,
      senderEmail: data.push_sender_email || undefined,
      senderName: data.push_sender_name || undefined,
    };
  } catch {
    return null;
  }
}

export async function saveVapidKeys(keys: { publicKey: string; privateKey: string; senderEmail?: string; senderName?: string }): Promise<void> {
  const { error } = await supabase.from('store_settings').upsert({
    id: 1,
    vapid_public_key: keys.publicKey,
    vapid_private_key: keys.privateKey,
    push_sender_email: keys.senderEmail || null,
    push_sender_name: keys.senderName || null,
  });
  if (error) throw new Error(error.message);
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    if (navigator.serviceWorker.controller) return reg;
    await new Promise<void>((resolve) => {
      if (navigator.serviceWorker.controller) return resolve();
      const handler = () => {
        navigator.serviceWorker.removeEventListener('controllerchange', handler);
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', handler);
    });
    return reg;
  } catch (err) {
    console.error('[push] SW registration failed:', err);
    return null;
  }
}

export async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg ?? null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isSubscribed(): Promise<boolean> {
  const reg = await getRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  return await Notification.requestPermission();
}

export async function subscribeUser(): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) throw new Error('Push não suportado neste navegador');
  const permission = await requestNotificationPermission();
  if (permission !== 'granted') throw new Error(`Permissão negada (${permission})`);

  const config = await loadPushConfig();
  if (!config) throw new Error('Chaves VAPID não configuradas no painel Admin.');

  let reg = await getRegistration();
  if (!reg) {
    reg = await registerServiceWorker();
    if (!reg) throw new Error('Falha ao registrar Service Worker.');
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const appServerKey = urlBase64ToUint8Array(config.vapidPublicKey);
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appServerKey });
  }

  const json = sub.toJSON() as PushSubscriptionJSON;
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    try { await sub.unsubscribe(); } catch { /* ignore */ }
    throw new Error('Falha ao salvar inscrição: ' + error.message);
  }

  return json;
}

export async function unsubscribeUser(): Promise<void> {
  const reg = await getRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    try {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
    } catch { /* ignore */ }
    try { await sub.unsubscribe(); } catch { /* ignore */ }
  }
}

/* ---------- Server-side helpers (Deno-friendly, used by push-send Edge Function) ---------- */

export function generateVAPIDKeysNode(): { publicKey: string; privateKey: string } {
  // Pure-TS fallback — lightweight VAPID generator using WebCrypto.
  // NOTE: this runs in the browser during admin key generation; for production you may also
  // generate on the server via web-push package.
  throw new Error('Use generateVAPIDKeys() for browser execution, or web-push on Node/Deno');
}

export async function generateVAPIDKeys(): Promise<{ publicKey: string; privateKey: string }> {
  if (typeof crypto === 'undefined' || !('subtle' in crypto) || !('CryptoKey' in window)) {
    throw new Error('WebCrypto não disponível neste navegador.');
  }

  const namedCurve = 'P-256' as const;
  const extractable = true;
  const keyUsages: KeyUsage[] = ['sign', 'verify'];

  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve }, extractable, keyUsages);

  const [privateRaw, publicRaw] = await Promise.all([
    crypto.subtle.exportKey('pkcs8', keys.privateKey),
    crypto.subtle.exportKey('raw', keys.publicKey),
  ]);

  return {
    publicKey: u8ToUrlBase64(new Uint8Array(publicRaw)),
    privateKey: u8ToUrlBase64(new Uint8Array(privateRaw)),
  };
}

function u8ToUrlBase64(u8: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < u8.byteLength; i++) binary += String.fromCharCode(u8[i]);
  const b64 = btoa(binary);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
