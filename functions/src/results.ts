import { applyResultToStats, computeResultSummary, emptyStats } from '@dots/game-engine';
import type { GameResultSummary } from '@dots/game-engine';
import type { GameDoc, PlayerStatsDoc } from '@dots/protocol';
import { onDocumentUpdated } from 'firebase-functions/firestore';
import { logger } from 'firebase-functions/logger';
import { REGION, db, now } from './app';
import { gameRef, roomRef, statsRef } from './refs';

/**
 * Persist the authoritative result and update every player's stats exactly
 * once (§10.4). Results come only from the stored game state, never from
 * client claims. Guarded by `resultsProcessed` inside the transaction, so
 * trigger retries cannot double-count.
 */
export async function saveGameResult(gameId: string): Promise<GameResultSummary | null> {
  return db.runTransaction(async (tx) => {
    const game = (await tx.get(gameRef(gameId))).data();
    if (!game || game.resultsProcessed || game.state.status !== 'finished') return null;
    const summary = computeResultSummary(game.state);
    const statsSnaps = await Promise.all(game.memberUids.map((uid) => tx.get(statsRef(uid))));
    const t = now();
    game.memberUids.forEach((uid, i) => {
      const previous = statsSnaps[i]!.data() ?? { ...emptyStats(), uid, updatedAt: t };
      const next: PlayerStatsDoc = { ...applyResultToStats(previous, summary, uid), uid, updatedAt: t };
      tx.set(statsRef(uid), next);
    });
    tx.update(gameRef(gameId), { resultsProcessed: true, result: summary, updatedAt: t } as Partial<GameDoc>);
    tx.update(roomRef(game.roomId), { status: 'finished', currentPlayerUid: null, updatedAt: t });
    return summary;
  });
}

export const onGameFinished = onDocumentUpdated({ document: 'games/{gameId}', region: REGION }, async (event) => {
  const before = event.data?.before.data() as GameDoc | undefined;
  const after = event.data?.after.data() as GameDoc | undefined;
  if (!after || after.resultsProcessed || after.state.status !== 'finished') return;
  if (before?.state.status === 'finished' && before.resultsProcessed) return;
  const summary = await saveGameResult(event.params.gameId);
  if (summary) logger.info('Recorded result', { gameId: event.params.gameId, winners: summary.winnerIds });
});
