import { forfeitPlayer } from '@dots/game-engine';
import type { Transaction } from 'firebase-admin/firestore';
import { now } from './app';
import { gameRef, roomRef } from './refs';

/**
 * Mark `uid` inactive in a live game (leave, forfeit or disconnect timeout).
 * Performs its reads first, so callers must not have written in `tx` yet.
 * Returns false when nothing changed.
 */
export async function forfeitInTransaction(tx: Transaction, gameId: string, uid: string): Promise<boolean> {
  const game = (await tx.get(gameRef(gameId))).data();
  if (!game || !game.memberUids.includes(uid) || game.state.status !== 'playing') return false;
  const t = now();
  const state = forfeitPlayer(game.state, uid, { now: t });
  if (state === game.state) return false;
  const turnChanged = state.currentPlayerIndex !== game.state.currentPlayerIndex;
  tx.update(gameRef(gameId), {
    state,
    updatedAt: t,
    ...(turnChanged ? { turnStartedAt: t } : {}),
  });
  tx.update(roomRef(game.roomId), {
    currentPlayerUid: state.status === 'playing' ? (state.players[state.currentPlayerIndex]?.id ?? null) : null,
    ...(state.status === 'finished' ? { status: 'finished' } : {}),
    updatedAt: t,
  });
  return true;
}
