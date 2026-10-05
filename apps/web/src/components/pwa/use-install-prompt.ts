'use client';

import { useSyncExternalStore } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __installPrompt?: BeforeInstallPromptEvent;
  }
}

/**
 * The browser fires `beforeinstallprompt` once, often before React hydrates, and
 * its `prompt()` can only be used once. An inline script in the root layout
 * captures it (`window.__installPrompt`); this module shares it so the install
 * sheet and the home-screen link stay in sync.
 */
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  const adopt = () => {
    deferred = window.__installPrompt ?? null;
    emit();
  };
  adopt();
  window.addEventListener('installpromptready', adopt);
  window.addEventListener('appinstalled', () => {
    deferred = null;
    window.__installPrompt = undefined;
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS has no install event; any browser there can Add to Home Screen from Share. */
export function isIos() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
}

/** Android browsers can always install from their menu, even without the event. */
export function isAndroid() {
  return /Android/.test(navigator.userAgent);
}

export function useInstallPrompt() {
  const prompt = useSyncExternalStore(
    subscribe,
    () => deferred,
    () => null,
  );

  /** Shows the native dialog; resolves true when the user accepts. */
  const install = async () => {
    if (!deferred) return false;
    const event = deferred;
    deferred = null;
    window.__installPrompt = undefined;
    emit();
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  };

  return { canPrompt: prompt !== null, install };
}
