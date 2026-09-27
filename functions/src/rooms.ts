import { createGame, getLevel } from '@dots/game-engine';
import {
  PLAYER_COLORS,
  ROOM_CREATE_LIMIT,
  ROOM_TTL_MS,
  createRoomRequest,
  generateRoomCode,
  joinRoomRequest,
  roomRequest,
  setPlayerReadyRequest,
} from '@dots/protocol';
import type {
  CreateRoomResponse,
  GameDoc,
  JoinRoomResponse,
  OkResponse,
  RoomDoc,
  RoomPlayerDoc,
  StartGameResponse,
} from '@dots/protocol';
import { randomInt } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Transaction } from 'firebase-admin/firestore';
import { db, now, rtdb } from './app';
import { callable } from './callable';
import { GameError } from './errors';
import { forfeitInTransaction } from './forfeit';
import { takeToken } from './rate-limit';
import { rateLimitRef, roomCodeRef, roomPlayerRef, roomPlayersRef, roomRef } from './refs';

const expiresAt = (t: number) => Timestamp.fromMillis(t + ROOM_TTL_MS);
const secureRandom = () => randomInt(0, 2 ** 32) / 2 ** 32;

async function setRtdbMembership(roomId: string, uid: string, member: boolean) {
  const ref = rtdb().ref(`rooms/${roomId}/members/${uid}`);
  await (member ? ref.set(true) : ref.remove());
}

export const createRoom = callable(createRoomRequest, async ({ uid, data }): Promise<CreateRoomResponse> => {
  const board = 'rows' in data.board ? data.board : getLevel(data.board.level);
  if (!board) throw new GameError('INVALID_ARGUMENT');
  const roomDoc = db.collection('rooms').doc();
  const candidates = Array.from({ length: 5 }, () => generateRoomCode(secureRandom));

  const code = await db.runTransaction(async (tx) => {
    const t = now();
    const limitRef = rateLimitRef(uid, 'createRoom');
    const limitSnap = await tx.get(limitRef);
    const { allowed, bucket } = takeToken(
      limitSnap.data(),
      t,
      ROOM_CREATE_LIMIT.capacity,
      ROOM_CREATE_LIMIT.refillPerMinute,
    );
    if (!allowed) throw new GameError('RATE_LIMITED');

    const codeSnaps = await Promise.all(candidates.map((c) => tx.get(roomCodeRef(c))));
    const free = candidates.find((_, i) => !codeSnaps[i]!.exists);
    if (!free) throw new GameError('RATE_LIMITED');

    const room: RoomDoc = {
      code: free,
      hostUid: uid,
      status: 'waiting',
      maxPlayers: data.maxPlayers,
      level: board.level,
      rows: board.rows,
      columns: board.columns,
      extraTurnOnCapture: data.extraTurnOnCapture,
      playerUids: [uid],
      activeGameId: null,
      currentPlayerUid: null,
      totalMoves: 0,
      createdAt: t,
      updatedAt: t,
      expiresAt: expiresAt(t),
    };
    const player: RoomPlayerDoc = {
      uid,
      name: data.name,
      color: PLAYER_COLORS[0],
      ready: true,
      joinedAt: t,
      connected: true,
      disconnectedAt: null,
    };
    tx.set(limitRef, bucket);
    tx.set(roomDoc as FirebaseFirestore.DocumentReference<RoomDoc>, room);
    tx.set(roomPlayerRef(roomDoc.id, uid), player);
    tx.set(roomCodeRef(free), { roomId: roomDoc.id, createdAt: t });
    tx.set(db.doc(`users/${uid}`), { displayName: data.name, createdAt: t }, { merge: true });
    return free;
  });

  await setRtdbMembership(roomDoc.id, uid, true);
  return { roomId: roomDoc.id, code };
});

export const joinRoom = callable(joinRoomRequest, async ({ uid, data }): Promise<JoinRoomResponse> => {
  const roomId = await db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(roomCodeRef(data.code));
    if (!codeSnap.exists) throw new GameError('ROOM_NOT_FOUND');
    const id = codeSnap.data()!.roomId;
    const roomSnap = await tx.get(roomRef(id));
    const room = roomSnap.data();
    if (!room) throw new GameError('ROOM_NOT_FOUND');
    if (room.playerUids.includes(uid)) return id; // idempotent re-join
    if (room.status !== 'waiting') throw new GameError('ROOM_NOT_JOINABLE');
    if (room.playerUids.length >= room.maxPlayers) throw new GameError('ROOM_FULL');

    const playersSnap = await tx.get(roomPlayersRef(id));
    const used = new Set(playersSnap.docs.map((d) => d.data().color));
    const color = PLAYER_COLORS.find((c) => !used.has(c)) ?? PLAYER_COLORS[0];
    const t = now();
    tx.set(roomPlayerRef(id, uid), {
      uid,
      name: data.name,
      color,
      ready: false,
      joinedAt: t,
      connected: true,
      disconnectedAt: null,
    });
    tx.update(roomRef(id), {
      playerUids: FieldValue.arrayUnion(uid) as unknown as string[],
      updatedAt: t,
      expiresAt: expiresAt(t),
    });
    tx.set(db.doc(`users/${uid}`), { displayName: data.name, createdAt: t }, { merge: true });
    return id;
  });
  await setRtdbMembership(roomId, uid, true);
  return { roomId };
});

export const setPlayerReady = callable(setPlayerReadyRequest, async ({ uid, data }): Promise<OkResponse> => {
  await db.runTransaction(async (tx) => {
    const room = (await tx.get(roomRef(data.roomId))).data();
    if (!room) throw new GameError('ROOM_NOT_FOUND');
    if (!room.playerUids.includes(uid)) throw new GameError('NOT_IN_ROOM');
    if (room.status !== 'waiting') throw new GameError('ROOM_NOT_JOINABLE');
    tx.update(roomPlayerRef(data.roomId, uid), { ready: data.ready });
    tx.update(roomRef(data.roomId), { updatedAt: now() });
  });
  return { ok: true };
});

export const startGame = callable(roomRequest, async ({ uid, data }): Promise<StartGameResponse> => {
  const gameDoc = db.collection('games').doc();
  await db.runTransaction(async (tx) => {
    const room = (await tx.get(roomRef(data.roomId))).data();
    if (!room) throw new GameError('ROOM_NOT_FOUND');
    if (room.hostUid !== uid) throw new GameError('NOT_HOST');
    if (room.status !== 'waiting') throw new GameError('ROOM_NOT_JOINABLE');
    const players = (await tx.get(roomPlayersRef(data.roomId))).docs
      .map((d) => d.data())
      .filter((p) => room.playerUids.includes(p.uid))
      .sort((a, b) => a.joinedAt - b.joinedAt);
    if (players.length < 2) throw new GameError('NOT_ENOUGH_PLAYERS');
    if (players.some((p) => p.uid !== room.hostUid && !p.ready)) throw new GameError('PLAYERS_NOT_READY');

    const t = now();
    const state = createGame({
      gameId: gameDoc.id,
      mode: 'online',
      level: room.level,
      rows: room.rows,
      columns: room.columns,
      players: players.map((p) => ({ id: p.uid, name: p.name, type: 'human' as const, color: p.color })),
      config: { extraTurnOnCapture: room.extraTurnOnCapture },
      startedAt: t,
    });
    const game: GameDoc = {
      state,
      roomId: data.roomId,
      seq: 0,
      memberUids: players.map((p) => p.uid),
      turnStartedAt: t,
      createdAt: t,
      updatedAt: t,
      resultsProcessed: false,
    };
    tx.set(gameDoc as FirebaseFirestore.DocumentReference<GameDoc>, game);
    tx.update(roomRef(data.roomId), {
      status: 'playing',
      activeGameId: gameDoc.id,
      currentPlayerUid: state.players[0]!.id,
      totalMoves: 0,
      updatedAt: t,
      expiresAt: expiresAt(t),
    });
    // The game has started: free the code so nobody else tries to join.
    tx.delete(roomCodeRef(room.code));
  });
  return { gameId: gameDoc.id };
});

async function leaveInTransaction(tx: Transaction, roomId: string, uid: string) {
  const room = (await tx.get(roomRef(roomId))).data();
  if (!room || !room.playerUids.includes(uid)) return { removed: false };
  const t = now();
  if (room.status === 'waiting') {
    if (room.hostUid === uid) {
      tx.update(roomRef(roomId), { status: 'cancelled', updatedAt: t });
      tx.delete(roomCodeRef(room.code));
    } else {
      tx.delete(roomPlayerRef(roomId, uid));
      tx.update(roomRef(roomId), {
        playerUids: FieldValue.arrayRemove(uid) as unknown as string[],
        updatedAt: t,
      });
    }
    return { removed: true };
  }
  if (room.status === 'playing' && room.activeGameId) {
    await forfeitInTransaction(tx, room.activeGameId, uid);
  }
  return { removed: false };
}

export const leaveRoom = callable(roomRequest, async ({ uid, data }): Promise<OkResponse> => {
  const { removed } = await db.runTransaction((tx) => leaveInTransaction(tx, data.roomId, uid));
  if (removed) await setRtdbMembership(data.roomId, uid, false);
  return { ok: true };
});
