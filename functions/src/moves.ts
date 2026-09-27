import { applyMove, getCurrentPlayer, isValidMove, parseEdgeId } from '@dots/game-engine';
import { moveDocId, submitMoveRequest } from '@dots/protocol';
import type { MoveDoc, SubmitMoveResponse } from '@dots/protocol';
import { db, now } from './app';
import { callable } from './callable';
import { GameError } from './errors';
import { gameRef, moveRef, roomRef } from './refs';

/**
 * Authoritative move (§5.5–5.6). Everything — edge, cells, scores, turn, move
 * count, status, winner, the move record and the room mirror — is committed in
 * one transaction. Firestore retries on contention, so of two concurrent
 * requests for the same edge exactly one commits; the other re-reads and gets
 * EDGE_ALREADY_USED. Retries with the same clientMoveId are idempotent.
 */
export const submitMove = callable(submitMoveRequest, async ({ uid, data }): Promise<SubmitMoveResponse> => {
  return db.runTransaction(async (tx) => {
    const gameSnap = await tx.get(gameRef(data.gameId));
    const game = gameSnap.data();
    if (!game) throw new GameError('GAME_NOT_FOUND');
    if (!game.memberUids.includes(uid)) throw new GameError('UNKNOWN_PLAYER');

    // Idempotent retry: this exact move was already accepted at expectedSeq.
    const existing = (await tx.get(moveRef(data.gameId, moveDocId(data.expectedSeq)))).data();
    if (existing && existing.clientMoveId === data.clientMoveId && existing.playerUid === uid) {
      return { acceptedSeq: existing.seq, duplicate: true };
    }

    const { state } = game;
    if (state.status !== 'playing') throw new GameError('GAME_NOT_PLAYING');
    if (!parseEdgeId(data.edgeId, state.rows, state.columns)) throw new GameError('INVALID_EDGE');
    if (!isValidMove(state, data.edgeId)) throw new GameError('EDGE_ALREADY_USED');
    if (game.seq !== data.expectedSeq) throw new GameError('STALE_STATE');
    if (getCurrentPlayer(state)?.id !== uid) throw new GameError('NOT_YOUR_TURN');

    const t = now();
    const result = applyMove(state, data.edgeId, uid, { now: t });
    if (!result.ok) throw new GameError(result.error);
    const next = result.gameState;
    const seq = game.seq;
    const move: MoveDoc = {
      seq,
      edgeId: data.edgeId,
      playerUid: uid,
      completedCells: result.completedCells,
      clientMoveId: data.clientMoveId,
      at: t,
    };
    const turnChanged = next.currentPlayerIndex !== state.currentPlayerIndex;
    tx.update(gameRef(data.gameId), {
      state: next,
      seq: seq + 1,
      updatedAt: t,
      ...(turnChanged ? { turnStartedAt: t } : {}),
    });
    tx.create(moveRef(data.gameId, moveDocId(seq)), move);
    tx.update(roomRef(game.roomId), {
      currentPlayerUid: result.gameOver ? null : (next.players[next.currentPlayerIndex]?.id ?? null),
      totalMoves: next.totalMoves,
      updatedAt: t,
      ...(result.gameOver ? { status: 'finished' } : {}),
    });
    return { acceptedSeq: seq, duplicate: false };
  });
});
