/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import { CacheFirst, CacheableResponsePlugin, NetworkOnly, RangeRequestsPlugin, Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Online play is explicitly network-dependent: never cache Firebase traffic. */
const FIREBASE_HOSTS = /(googleapis\.com|firebaseio\.com|firebasedatabase\.app|cloudfunctions\.net|run\.app|gstatic\.com\/recaptcha)$/;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Routes like /play/setup?mode=cpu should hit the precached /play/setup shell.
  precacheOptions: { ignoreURLParametersMatching: [/.*/] },
  // Wait for the user to accept an update so an active local game is never
  // interrupted (§8.3). The page sends SKIP_WAITING when it is safe.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin }) =>
        !sameOrigin && (FIREBASE_HOSTS.test(url.hostname) || url.hostname === 'localhost' || url.hostname === '127.0.0.1'),
      handler: new NetworkOnly(),
    },
    // The theme track: fetched whole on first play, then served from cache offline.
    // Kept indefinitely (defaultCache would expire audio after 24 h).
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/audio/'),
      handler: new CacheFirst({
        cacheName: 'game-music',
        plugins: [new CacheableResponsePlugin({ statuses: [200] }), new RangeRequestsPlugin()],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher: ({ request }) => request.destination === 'document',
      },
    ],
  },
});

/**
 * Turbopack's worker bootstrap (used by the CPU Web Worker) reads its config
 * from the `#params=` fragment of its own URL. A worker's `location` comes from
 * the response URL, and precached responses carry the URL without the fragment,
 * so the bootstrap throws "Missing worker bootstrap config". Serve it as a new
 * response instead: with no URL of its own, the worker keeps the requested URL
 * and its fragment. Registered before Serwist's listener, which it then skips.
 */
// Vercel serves static chunks from /_next/static/immutable/chunks/, locally /_next/static/chunks/.
const WORKER_BOOTSTRAP = /^\/_next\/static\/(?:[^/]+\/)*turbopack-worker-[^/]+\.js$/;

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !WORKER_BOOTSTRAP.test(url.pathname)) return;
  event.stopImmediatePropagation();
  event.respondWith(
    (async () => {
      const response = (await serwist.matchPrecache(url.pathname)) ?? (await fetch(event.request));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    })(),
  );
});

/** Turn notifications for async games (data-only FCM messages, see functions/src/notify.ts). */
interface TurnPush {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event) => {
  let payload: { data?: TurnPush } & TurnPush = {};
  try {
    payload = event.data?.json() ?? {};
  } catch {
    // Not JSON: show a generic notification below.
  }
  const data = payload.data ?? payload;
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Dotsnatch', {
      body: data.body ?? 'It’s your turn.',
      tag: data.tag,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/online' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data as { url?: string } | null)?.url ?? '/online', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        await open.navigate(target).catch(() => undefined);
      } else {
        await self.clients.openWindow(target);
      }
    })(),
  );
});

serwist.addEventListeners();
