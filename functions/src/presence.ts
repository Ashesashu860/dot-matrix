import { claimInactivityRequest, gameRequest } from '@dots/protocol';
import type { OkResponse, PresenceNode, ReconnectResponse, RoomDoc } from '@dots/protocol';
import { onValueWritten } from 'firebase-functions/database';
import { z } from 'zod';
import { REGION, config, db, now } from './app';
import { callable } from './callable';
import { GameError } from './errors';
import { forfeitInTransaction } from './forfeit';
import { gameRef, roomPlayerRef } from './refs';

/**
 * Mirror RTDB presence (/status/{roomId}/{uid}) into Firestore so other players
 * see who is disconnected and the server can enforce the grace period (§6.4).
 */
export const onPresenceWritten = onValueWritten(
  { ref: '/status/{roomId}/{uid}', region: REGION },
  async (event) => {
    const { roomId, uid } = event.params;
    const node = event.data.after.val() as PresenceNode | null;
    const connected = node?.state === 'online';
    const ref = roomPlayerRef(roomId, uid);
    const snap = await ref.get();
    if (!snap.exists) return;
    const current = snap.data()!;
    if (current.connected === connected) return;
    await ref.update({
      connected,
      disconnectedAt: connected ? null : typeof node?.at === 'number' ? node.at : now(),
    });
  },
);

/**
 * Any active player may ask the server to drop a player who has been offline
 * longer than the grace period. The server verifies the claim itself.
 */
export const claimInactivity = callable(claimInactivityRequest, async ({ uid, data }): Promise<OkResponse> => {
  await db.runTransaction(async (tx) => {
    const game = (await tx.get(gameRef(data.gameId))).data();
    if (!game) throw new GameError('GAME_NOT_FOUND');
    const caller = game.state.players.find((p) => p.id === uid);
    if (!caller?.active) throw new GameError('UNKNOWN_PLAYER');
    if (!game.memberUids.includes(data.targetUid)) throw new GameError('UNKNOWN_PLAYER');
    const target = (await tx.get(roomPlayerRef(game.roomId, data.targetUid))).data();
    const offlineSince = target?.connected === false ? target.disconnectedAt : null;
    if (offlineSince === null || offlineSince === undefined || now() - offlineSince < config.presenceGraceMs) {
      throw new GameError('PLAYER_STILL_CONNECTED');
    }
    await forfeitInTransaction(tx, data.gameId, data.targetUid);
  });
  return { ok: true };
});

export const forfeitGame = callable(gameRequest, async ({ uid, data }): Promise<OkResponse> => {
  await db.runTransaction(async (tx) => {
    const game = (await tx.get(gameRef(data.gameId))).data();
    if (!game) throw new GameError('GAME_NOT_FOUND');
    if (!game.memberUids.includes(uid)) throw new GameError('UNKNOWN_PLAYER');
    await forfeitInTransaction(tx, data.gameId, uid);
  });
  return { ok: true };
});

/** Find the caller's current room/game so a reconnecting client can resubscribe. */
export const reconnectPlayer = callable(z.object({}), async ({ uid }): Promise<ReconnectResponse> => {
  const snap = await db
    .collection('rooms')
    .where('playerUids', 'array-contains', uid)
    .where('status', 'in', ['waiting', 'playing'])
    .orderBy('updatedAt', 'desc')
    .limit(1)
    .get();
  const doc = snap.docs[0];
  if (!doc) return { roomId: null, gameId: null };
  const room = doc.data() as RoomDoc;
  if (room.activeGameId) {
    const game = (await gameRef(room.activeGameId).get()).data();
    const me = game?.state.players.find((p) => p.id === uid);
    // A player who already forfeited cannot rejoin that game.
    if (!me?.active) return { roomId: null, gameId: null };
  }
  return { roomId: doc.id, gameId: room.activeGameId };
});
