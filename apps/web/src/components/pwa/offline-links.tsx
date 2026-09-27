'use client';

import { useEffect } from 'react';
import { isOffline } from '@/lib/navigation';

/**
 * While offline, turn same-origin link clicks into full page loads before
 * Next.js's <Link> handler runs, so the service worker can serve the precached
 * page instead of a client navigation that would fail.
 */
export function OfflineLinks() {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isOffline() || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(url.href);
    };
    // Capture phase runs before React's delegated handlers.
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
  }, []);
  return null;
}
