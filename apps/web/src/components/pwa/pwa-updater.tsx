'use client';

import { useSerwist } from '@serwist/turbopack/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { hasActiveLocalGame } from '@/stores/session-store';

/**
 * Offers a new app version once its service worker is waiting. The update is
 * applied only when the user accepts and no local game is running, so an active
 * game is never destroyed (§8.3). Games are also saved every move, so a reload
 * resumes them.
 */
export function PwaUpdater() {
  const { serwist } = useSerwist();

  useEffect(() => {
    if (!serwist) return;
    const onWaiting = () => {
      toast('A new version of Dotsnatch is available', {
        id: 'pwa-update',
        duration: Infinity,
        action: {
          label: 'Update',
          onClick: () => {
            if (hasActiveLocalGame()) {
              toast.info('Finish or exit your game first — it is saved and will update afterwards.');
              return;
            }
            serwist.addEventListener('controlling', () => window.location.reload());
            serwist.messageSkipWaiting();
          },
        },
      });
    };
    serwist.addEventListener('waiting', onWaiting);
    return () => serwist.removeEventListener('waiting', onWaiting);
  }, [serwist]);

  return null;
}
