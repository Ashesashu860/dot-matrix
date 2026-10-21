import type { PushTokenDoc } from '@dots/protocol';
import type { CollectionReference } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from 'firebase-functions/logger';
import { db } from './app';

const pushTokensRef = (uid: string) => db.collection(`users/${uid}/pushTokens`) as CollectionReference<PushTokenDoc>;

/** Tokens FCM reports as gone; their docs are deleted. */
const DEAD_TOKEN = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);

/**
 * Tell `uid` it is their turn in an async game. Best effort: a failed push
 * never fails the move. Data-only, so the app's service worker builds the
 * notification and routes the click.
 */
export async function notifyTurn(uid: string, roomId: string, byName: string): Promise<void> {
  // FCM is not emulated.
  if (process.env.FUNCTIONS_EMULATOR === 'true') return;
  try {
    const snap = await pushTokensRef(uid).get();
    if (snap.empty) return;
    const docs = snap.docs;
    const result = await getMessaging().sendEachForMulticast({
      tokens: docs.map((d) => d.data().token),
      data: { title: 'Your turn in Dotsnatch', body: `${byName} made a move.`, url: `/online/room?id=${roomId}`, tag: roomId },
      webpush: { headers: { Urgency: 'high', TTL: '86400' } },
    });
    await Promise.all(
      result.responses.map((r, i) =>
        !r.success && r.error && DEAD_TOKEN.has(r.error.code) ? docs[i]!.ref.delete() : Promise.resolve(),
      ),
    );
  } catch (error) {
    logger.warn('Turn notification failed', { uid, roomId, error });
  }
}
