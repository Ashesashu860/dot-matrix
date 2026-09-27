import { getValidMoves } from '@dots/game-engine';
import type {
  CreateRoomResponse,
  GameDoc,
  JoinRoomResponse,
  MoveDoc,
  PlayerStatsDoc,
  ReconnectResponse,
  RoomDoc,
  RoomPlayerDoc,
  StartGameResponse,
  SubmitMoveResponse,
} from '@dots/protocol';
import { ref, set } from 'firebase/database';
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { afterAll, describe, expect, it } from 'vitest';
import { expectCode, newPlayer, waitFor } from './client';
import type { TestPlayer } from './client';

const players: TestPlayer[] = [];
async function player() {
  const p = await newPlayer();
  players.push(p);
  return p;
}
afterAll(async () => {
  await Promise.all(players.map((p) => p.dispose()));
});

async function readGame(p: TestPlayer, gameId: string) {
  return (await getDoc(doc(p.firestore, 'games', gameId))).data() as GameDoc;
}

/** Host + guests in a started game on the given level. */
async function startedGame(guestCount = 1, level = 1) {
  const host = await player();
  const guests = await Promise.all(Array.from({ length: guestCount }, player));
  const { roomId, code } = await host.call<CreateRoomResponse>('createRoom', { name: 'Host', board: { level } });
  for (const [i, g] of guests.entries()) {
    await g.call<JoinRoomResponse>('joinRoom', { code, name: `Guest ${i}` });
    await g.call('setPlayerReady', { roomId, ready: true });
  }
  const { gameId } = await host.call<StartGameResponse>('startGame', { roomId });
  return { host, guests, roomId, gameId, all: [host, ...guests] };
}

/** Submit a move for whoever's turn it is. */
async function moveForCurrent(all: TestPlayer[], gameId: string, edgeId?: string) {
  const game = await readGame(all[0]!, gameId);
  const current = game.state.players[game.state.currentPlayerIndex]!.id;
  const mover = all.find((p) => p.uid === current)!;
  const edge = edgeId ?? getValidMoves(game.state)[0]!.id;
  return mover.call<SubmitMoveResponse>('submitMove', {
    gameId,
    edgeId: edge,
    expectedSeq: game.seq,
    clientMoveId: `m-${game.seq}-${Math.random().toString(36).slice(2)}`,
  });
}

describe('rooms', () => {
  it('creates a room with a readable code and registers the host', async () => {
    const host = await player();
    const res = await host.call<CreateRoomResponse>('createRoom', { name: '  Ada  ', board: { level: 2 } });
    expect(res.code).toMatch(/^[2-9A-Z]{6}$/);
    const room = (await getDoc(doc(host.firestore, 'rooms', res.roomId))).data() as RoomDoc;
    expect(room).toMatchObject({ hostUid: host.uid, status: 'waiting', rows: 5, columns: 5, maxPlayers: 4 });
    const me = (await getDoc(doc(host.firestore, 'rooms', res.roomId, 'players', host.uid))).data() as RoomPlayerDoc;
    expect(me.name).toBe('Ada');
  });

  it('validates inputs server-side', async () => {
    const host = await player();
    await expectCode(host.call('createRoom', { name: '', board: { level: 1 } }), 'INVALID_ARGUMENT');
    await expectCode(host.call('createRoom', { name: 'x', board: { level: 99 } }), 'INVALID_ARGUMENT');
    await expectCode(host.call('joinRoom', { code: '!!', name: 'x' }), 'INVALID_ARGUMENT');
  });

  it('joins by code, enforces capacity and rejects unknown codes', async () => {
    const host = await player();
    const { roomId, code } = await host.call<CreateRoomResponse>('createRoom', {
      name: 'Host',
      board: { level: 1 },
      maxPlayers: 2,
    });
    const guest = await player();
    const joined = await guest.call<JoinRoomResponse>('joinRoom', { code: code.toLowerCase(), name: 'Bob' });
    expect(joined.roomId).toBe(roomId);
    // Joining twice is idempotent.
    expect((await guest.call<JoinRoomResponse>('joinRoom', { code, name: 'Bob' })).roomId).toBe(roomId);
    const third = await player();
    await expectCode(third.call('joinRoom', { code, name: 'Cy' }), 'ROOM_FULL');
    await expectCode(third.call('joinRoom', { code: 'ZZZZZZ', name: 'Cy' }), 'ROOM_NOT_FOUND');
  });

  it('only the host can start, and only when everyone is ready', async () => {
    const host = await player();
    const guest = await player();
    const { roomId, code } = await host.call<CreateRoomResponse>('createRoom', { name: 'Host', board: { level: 1 } });
    await expectCode(host.call('startGame', { roomId }), 'NOT_ENOUGH_PLAYERS');
    await guest.call('joinRoom', { code, name: 'Bob' });
    await expectCode(guest.call('startGame', { roomId }), 'NOT_HOST');
    await expectCode(host.call('startGame', { roomId }), 'PLAYERS_NOT_READY');
    await guest.call('setPlayerReady', { roomId, ready: true });
    const { gameId } = await host.call<StartGameResponse>('startGame', { roomId });
    const game = await readGame(host, gameId);
    expect(game.state.players.map((p) => p.id)).toEqual([host.uid, guest.uid]);
    expect(game.seq).toBe(0);
    const late = await player();
    await expectCode(late.call('joinRoom', { code, name: 'Late' }), 'ROOM_NOT_FOUND');
  });

  it('host leaving a waiting room cancels it', async () => {
    const host = await player();
    const { roomId } = await host.call<CreateRoomResponse>('createRoom', { name: 'Host', board: { level: 1 } });
    await host.call('leaveRoom', { roomId });
    const room = (await getDoc(doc(host.firestore, 'rooms', roomId))).data() as RoomDoc;
    expect(room.status).toBe('cancelled');
  });

  it('rate-limits room creation', async () => {
    const host = await player();
    for (let i = 0; i < 5; i++) await host.call('createRoom', { name: 'Spam', board: { level: 1 } });
    await expectCode(host.call('createRoom', { name: 'Spam', board: { level: 1 } }), 'RATE_LIMITED');
  });
});

describe('submitMove', () => {
  it('applies a valid move atomically and records it', async () => {
    const { host, gameId, roomId } = await startedGame();
    const res = await host.call<SubmitMoveResponse>('submitMove', {
      gameId,
      edgeId: 'H-0-0',
      expectedSeq: 0,
      clientMoveId: 'first',
    });
    expect(res).toEqual({ acceptedSeq: 0, duplicate: false });
    const game = await readGame(host, gameId);
    expect(game.seq).toBe(1);
    expect(game.state.edges['H-0-0']?.claimedBy).toBe(host.uid);
    expect(game.state.currentPlayerIndex).toBe(1);
    const moves = await getDocs(query(collection(host.firestore, 'games', gameId, 'moves'), orderBy('seq')));
    expect(moves.docs.map((d) => (d.data() as MoveDoc).edgeId)).toEqual(['H-0-0']);
    const room = (await getDoc(doc(host.firestore, 'rooms', roomId))).data() as RoomDoc;
    expect(room.totalMoves).toBe(1);
    expect(room.currentPlayerUid).toBe(game.state.players[1]!.id);
  });

  it('rejects wrong turn, invalid edges, stale sequence and non-members', async () => {
    const { host, guests, gameId } = await startedGame();
    const guest = guests[0]!;
    await expectCode(
      guest.call('submitMove', { gameId, edgeId: 'H-0-0', expectedSeq: 0, clientMoveId: 'a' }),
      'NOT_YOUR_TURN',
    );
    await expectCode(
      host.call('submitMove', { gameId, edgeId: 'D-1-1', expectedSeq: 0, clientMoveId: 'b' }),
      'INVALID_EDGE',
    );
    await expectCode(
      host.call('submitMove', { gameId, edgeId: 'H-0-0', expectedSeq: 3, clientMoveId: 'c' }),
      'STALE_STATE',
    );
    const outsider = await player();
    await expectCode(
      outsider.call('submitMove', { gameId, edgeId: 'H-0-0', expectedSeq: 0, clientMoveId: 'd' }),
      'UNKNOWN_PLAYER',
    );
    await host.call('submitMove', { gameId, edgeId: 'H-0-0', expectedSeq: 0, clientMoveId: 'e' });
    await expectCode(
      guest.call('submitMove', { gameId, edgeId: 'H-0-0', expectedSeq: 1, clientMoveId: 'f' }),
      'EDGE_ALREADY_USED',
    );
  });

  it('two simultaneous requests for the same edge: exactly one wins, nothing is double-counted', async () => {
    const { host, gameId } = await startedGame();
    const attempt = (id: string) =>
      host
        .call<SubmitMoveResponse>('submitMove', { gameId, edgeId: 'V-1-1', expectedSeq: 0, clientMoveId: id })
        .then(() => 'ok' as const)
        .catch((e: { details?: { code?: string } }) => e.details?.code);
    const results = await Promise.all([attempt('race-a'), attempt('race-b'), attempt('race-c')]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    for (const r of results.filter((r) => r !== 'ok')) {
      expect(['EDGE_ALREADY_USED', 'STALE_STATE']).toContain(r);
    }
    const game = await readGame(host, gameId);
    expect(game.seq).toBe(1);
    expect(game.state.totalMoves).toBe(1);
    expect(game.state.currentPlayerIndex).toBe(1);
    const moves = await getDocs(collection(host.firestore, 'games', gameId, 'moves'));
    expect(moves.size).toBe(1);
  });

  it('a retried request with the same clientMoveId is idempotent', async () => {
    const { host, gameId } = await startedGame();
    const req = { gameId, edgeId: 'H-1-1', expectedSeq: 0, clientMoveId: 'retry-me' };
    const first = await host.call<SubmitMoveResponse>('submitMove', req);
    const second = await host.call<SubmitMoveResponse>('submitMove', req);
    expect(first).toEqual({ acceptedSeq: 0, duplicate: false });
    expect(second).toEqual({ acceptedSeq: 0, duplicate: true });
    expect((await readGame(host, gameId)).seq).toBe(1);
  });

  it('plays a full game; stats are written once from authoritative state', async () => {
    const { host, guests, gameId, roomId, all } = await startedGame(1, 1);
    for (let i = 0; i < 24; i++) await moveForCurrent(all, gameId);
    const game = await readGame(host, gameId);
    expect(game.state.status).toBe('finished');
    expect(game.state.players.reduce((s, p) => s + p.score, 0)).toBe(9);
    await expectCode(moveForCurrent(all, gameId, 'H-0-0'), 'GAME_NOT_PLAYING');

    const processed = await waitFor(async () => (await readGame(host, gameId)).resultsProcessed);
    expect(processed).toBe(true);
    const hostStats = (await getDoc(doc(host.firestore, 'playerStats', host.uid))).data() as PlayerStatsDoc;
    const guestStats = (await getDoc(doc(guests[0]!.firestore, 'playerStats', guests[0]!.uid))).data() as PlayerStatsDoc;
    expect(hostStats.gamesPlayed).toBe(1);
    expect(guestStats.gamesPlayed).toBe(1);
    expect(hostStats.byMode.online).toBe(1);
    expect(hostStats.cellsCaptured + guestStats.cellsCaptured).toBe(9);
    const room = (await getDoc(doc(host.firestore, 'rooms', roomId))).data() as RoomDoc;
    expect(room.status).toBe('finished');
  });
});

describe('presence, forfeit and reconnect', () => {
  it('mirrors RTDB presence into Firestore and enforces the grace period', async () => {
    const { host, guests, gameId, roomId } = await startedGame(2);
    const [g1] = guests;
    const statusRef = ref(g1!.database, `status/${roomId}/${g1!.uid}`);
    await set(statusRef, { state: 'online', at: Date.now() });
    await set(statusRef, { state: 'offline', at: Date.now() });

    const playerDoc = () => getDoc(doc(host.firestore, 'rooms', roomId, 'players', g1!.uid));
    await waitFor(async () => (await playerDoc()).data()?.connected === false);

    // Still inside the 2s emulator grace period.
    await expectCode(host.call('claimInactivity', { gameId, targetUid: g1!.uid }), 'PLAYER_STILL_CONNECTED');
    await new Promise((r) => setTimeout(r, 2200));
    await host.call('claimInactivity', { gameId, targetUid: g1!.uid });
    const game = await readGame(host, gameId);
    expect(game.state.players.find((p) => p.id === g1!.uid)?.active).toBe(false);
    expect(game.state.status).toBe('playing'); // two players remain
  });

  it('forfeiting ends a two-player game in favour of the remaining player', async () => {
    const { host, guests, gameId } = await startedGame(1);
    await guests[0]!.call('forfeitGame', { gameId });
    const game = await readGame(host, gameId);
    expect(game.state.status).toBe('finished');
    expect(game.state.winnerIds).toEqual([host.uid]);
  });

  it('reconnectPlayer returns the active room and game for the same uid', async () => {
    const { guests, gameId, roomId } = await startedGame(1);
    const res = await guests[0]!.call<ReconnectResponse>('reconnectPlayer');
    expect(res).toEqual({ roomId, gameId });
    const stranger = await player();
    expect(await stranger.call<ReconnectResponse>('reconnectPlayer')).toEqual({ roomId: null, gameId: null });
  });
});
