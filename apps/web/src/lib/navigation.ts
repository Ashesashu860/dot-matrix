'use client';

import type { useRouter } from 'next/navigation';

type Router = ReturnType<typeof useRouter>;

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Client navigation needs an RSC fetch, which cannot succeed offline. When
 * offline, use a full page load instead: the service worker serves the
 * precached page shell (§8.3).
 */
export function navigate(router: Router, href: string, { replace = false } = {}) {
  if (isOffline()) {
    if (replace) window.location.replace(href);
    else window.location.assign(href);
    return;
  }
  if (replace) router.replace(href);
  else router.push(href);
}
