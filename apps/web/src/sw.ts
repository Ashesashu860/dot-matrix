/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from '@serwist/turbopack/worker';
import { NetworkOnly, Serwist } from 'serwist';
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

serwist.addEventListeners();
