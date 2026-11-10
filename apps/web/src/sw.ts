/// <reference lib="webworker" />
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

// ── Offline app shell ────────────────────────────────
// The built app (HTML, JS, CSS, icons) is precached, so pages open without a connection.
// API calls are never cached: availability and bookings must always be live.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({ cacheName: 'google-fonts-css' }),
);
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 })],
  }),
);

// The wall-selection model and its WebAssembly runtime are big (tens of MB) and never change for a
// given file name, so keep them after the first download. They are fetched only when the
// visualizer is opened, and are not part of the precached app shell.
registerRoute(
  ({ url }) =>
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/models/') || url.pathname.startsWith('/ort/')),
  new CacheFirst({
    cacheName: 'wall-model',
    plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 180 * 24 * 3600 })],
  }),
);

// "Reload to update" from the app.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// ── Push notifications ───────────────────────────────

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  lang?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload;
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Painting Quote', {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: data.tag,
      lang: data.lang,
      data: { url: data.url ?? '/' },
    }),
  );
});

// Tapping a notification opens (or focuses) the app on the right page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(
    (event.notification.data as { url?: string } | null)?.url ?? '/',
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          await client.navigate(url).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
