/* Mamajula Service Worker — Web Push handler */

const SW_VERSION = 'v1-mamajula-push';
const DEFAULT_ICON = '/image.png';
const DEFAULT_BADGE = '/image.png';

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Mamajula', body: '', image: '', url: '/', tag: 'mamajula' };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    }
  } catch {
    // Plain text fallback
    if (event.data) {
      payload.body = event.data.text();
    }
  }

  const options = {
    body: payload.body || '',
    icon: payload.icon || DEFAULT_ICON,
    badge: payload.badge || DEFAULT_BADGE,
    image: payload.image || undefined,
    tag: payload.tag || 'mamajula',
    data: { url: payload.url || '/', productId: payload.productId || null },
    requireInteraction: false,
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Mamajula', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            return client.focus();
          } catch {
            /* ignore */
          }
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
