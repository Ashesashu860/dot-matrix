import { onSchedule } from 'firebase-functions/scheduler';
import { logger } from 'firebase-functions/logger';
import { REGION, db, now } from './app';
import { forfeitInTransaction } from './forfeit';
import { gameRef } from './refs';

/**
 * Forfeit players in async games whose turn deadline has passed. Players can
 * also claim this themselves (claimInactivity); the sweep covers games nobody
 * opens. Each game is re-checked inside its own transaction.
 */
export async function expireAsyncTurns(t = now()): Promise<number> {
  const due = await db
    .collection('games')
    .where('pace', '==', 'async')
    .where('turnDeadline', '<=', t)
    .limit(200)
    .get();
  let expired = 0;
  for (const doc of due.docs) {
    const forfeited = await db.runTransaction(async (tx) => {
      const game = (await tx.get(gameRef(doc.id))).data();
      if (!game || game.state.status !== 'playing' || !game.turnDeadline || game.turnDeadline > t) return false;
      const current = game.state.players[game.state.currentPlayerIndex]?.id;
      return current ? forfeitInTransaction(tx, doc.id, current) : false;
    });
    if (forfeited) expired++;
  }
  return expired;
}

export const expireTurns = onSchedule({ schedule: 'every 15 minutes', region: REGION }, async () => {
  const expired = await expireAsyncTurns();
  if (expired) logger.info('Expired async turns', { expired });
});
