'use client';

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { getFirebase } from './client';

/** Web push key from Firebase console → Cloud Messaging → Web Push certificates. */
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** Turn notifications need a configured key, a service worker and the Push API. */
export function canNotify(): boolean {
  return (
    !!VAPID_KEY &&
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'PushManager' in window &&
    'serviceWorker' in navigator
  );
}

export function notificationsAllowed(): boolean {
  return canNotify() && Notification.permission === 'granted';
}

async function tokenId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Ask for permission (must run from a tap) and register this device's push
 * token, so the server can tell this player when it is their turn in an async
 * game. Pushes arrive at the app's own service worker (src/sw.ts).
 */
export async function enableTurnNotifications(uid: string): Promise<boolean> {
  if (!canNotify() || !(await isSupported())) return false;
  if ((await Notification.requestPermission()) !== 'granted') return false;
  const { app, firestore } = getFirebase();
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: await navigator.serviceWorker.ready,
  });
  const ref = doc(firestore, 'users', uid, 'pushTokens', await tokenId(token));
  // Tokens are create-only; re-registering the same device is a no-op.
  if (!(await getDoc(ref)).exists()) await setDoc(ref, { token, createdAt: Date.now() });
  return true;
}
