import { MAX_DOTS } from '@dots/game-engine';
import { useSyncExternalStore } from 'react';

export interface BoardLimits {
  rows: number;
  columns: number;
}

/** Custom board limits (in dots) on phones, where a big grid would be too small to tap. */
export const MOBILE_BOARD_LIMITS: BoardLimits = { rows: 20, columns: 10 };
export const DESKTOP_BOARD_LIMITS: BoardLimits = { rows: MAX_DOTS, columns: MAX_DOTS };

const DESKTOP_QUERY = '(min-width: 768px)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/** Custom board limits for the current screen: desktop from 768px wide, mobile below. */
export function useBoardLimits(): BoardLimits {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false,
  );
  return desktop ? DESKTOP_BOARD_LIMITS : MOBILE_BOARD_LIMITS;
}
