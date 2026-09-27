'use client';

import { onDisconnect, onValue, ref, serverTimestamp, set } from 'firebase/database';
import { getFirebase } from './client';

/**
 * Realtime Database presence for a room (§6.3). Marks this player online while
 * connected and lets the server mark them offline if the connection drops.
 * Returns a stop function.
 */
export function trackPresence(roomId: string, uid: string, onConnection: (connected: boolean) => void): () => void {
  const { database } = getFirebase();
  const statusRef = ref(database, `status/${roomId}/${uid}`);
  let stopped = false;

  const goOnline = async (attempt = 0): Promise<void> => {
    try {
      await onDisconnect(statusRef).set({ state: 'offline', at: serverTimestamp() });
      await set(statusRef, { state: 'online', at: serverTimestamp() });
    } catch {
      // Membership may not be mirrored to RTDB yet right after joining; retry briefly.
      if (!stopped && attempt < 5) setTimeout(() => void goOnline(attempt + 1), 800 * (attempt + 1));
    }
  };

  const unsubscribe = onValue(ref(database, '.info/connected'), (snap) => {
    const connected = snap.val() === true;
    onConnection(connected);
    if (connected) void goOnline();
  });

  return () => {
    stopped = true;
    unsubscribe();
    void set(statusRef, { state: 'offline', at: serverTimestamp() }).catch(() => {});
  };
}
