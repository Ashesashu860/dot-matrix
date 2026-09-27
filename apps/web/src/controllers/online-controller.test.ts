import { applyMove, createGame } from '@dots/game-engine';
import type { GameDoc, RoomPlayerDoc, SubmitMoveRequest } from '@dots/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnlineController } from './online-controller';
import type { GameSnapshot, OnlineTransport } from './online-controller';
import { canInteract } from './types';

function gameDoc(): GameDoc {
  const state = createGame({
    gameId: 'g',
    mode: 'online',
    level: 1,
    rows: 4,
    columns: 4,
    players: [
      { id: 'me', name: 'Me', type: 'human', color: '#00f' },
      { id: 'them', name: 'Them', type: 'human', color: '#f00' },
    ],
  });
  return { state, roomId: 'r', seq: 0, memberUids: ['me', 'them'], turnStartedAt: 0, createdAt: 0, updatedAt: 0, resultsProcessed: false };
}

function fakeTransport() {
  let emitGame: (s: GameSnapshot) => void = () => {};
  let emitPlayers: (p: RoomPlayerDoc[]) => void = () => {};
  const submitted: SubmitMoveRequest[] = [];
  let ids = 0;
  const transport: OnlineTransport & { submitImpl: (r: SubmitMoveRequest) => Promise<{ acceptedSeq: number; duplicate: boolean }> } = {
    submitImpl: async (r) => ({ acceptedSeq: r.expectedSeq, duplicate: false }),
    subscribeGame(cb) {
      emitGame = cb;
      return () => {};
    },
    subscribePlayers(cb) {
      emitPlayers = cb;
      return () => {};
    },
    submitMove(r) {
      submitted.push(r);
      return transport.submitImpl(r);
    },
    claimInactivity: vi.fn(async () => ({ ok: true })),
    newMoveId: () => `m${++ids}`,
  };
  return { transport, submitted, emitGame: (s: GameSnapshot) => emitGame(s), emitPlayers: (p: RoomPlayerDoc[]) => emitPlayers(p) };
}

/** Simulate the server accepting a move and pushing the new snapshot. */
function serverApply(doc: GameDoc, edgeId: string, uid: string): GameDoc {
  const r = applyMove(doc.state, edgeId, uid);
  if (!r.ok) throw new Error(r.error);
  return { ...doc, state: r.gameState, seq: doc.seq + 1 };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => vi.useRealTimers());

describe('OnlineController', () => {
  it('shows a pending edge until the authoritative snapshot confirms it', async () => {
    const initial = gameDoc();
    const t = fakeTransport();
    const c = new OnlineController(initial, 'me', t.transport);
    expect(canInteract(c.getView())).toBe(true);

    c.submitMove('H-0-0');
    expect(c.getView().pendingEdgeId).toBe('H-0-0');
    expect(canInteract(c.getView())).toBe(false);
    expect(t.submitted[0]).toMatchObject({ gameId: 'g', edgeId: 'H-0-0', expectedSeq: 0 });
    // A second tap while pending is ignored.
    c.submitMove('H-0-1');
    expect(t.submitted).toHaveLength(1);

    await flush();
    expect(c.getView().pendingEdgeId).toBe('H-0-0');
    t.emitGame({ game: serverApply(initial, 'H-0-0', 'me'), fromCache: false });
    expect(c.getView().pendingEdgeId).toBeNull();
    expect(c.getView().state.edges['H-0-0']?.claimedBy).toBe('me');
    expect(c.getView().lastEvent).toMatchObject({ edgeId: 'H-0-0', playerId: 'me', extraTurn: false });
    // Now it's their turn.
    expect(canInteract(c.getView())).toBe(false);
    c.submitMove('H-0-1');
    expect(t.submitted).toHaveLength(1);
  });

  it('retries network failures with the same clientMoveId', async () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    let calls = 0;
    t.transport.submitImpl = async (r) => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('net'), { code: 'NETWORK' });
      return { acceptedSeq: r.expectedSeq, duplicate: calls > 1 };
    };
    const c = new OnlineController(gameDoc(), 'me', t.transport);
    c.submitMove('V-1-1');
    await vi.advanceTimersByTimeAsync(5_000);
    expect(t.submitted).toHaveLength(3);
    expect(new Set(t.submitted.map((s) => s.clientMoveId)).size).toBe(1);
    expect(c.getView().error).toBeNull();
  });

  it('clears the pending edge and reports rejections', async () => {
    const t = fakeTransport();
    t.transport.submitImpl = async () => {
      throw Object.assign(new Error('taken'), { code: 'EDGE_ALREADY_USED' });
    };
    const c = new OnlineController(gameDoc(), 'me', t.transport);
    c.submitMove('H-0-0');
    await flush();
    expect(c.getView().pendingEdgeId).toBeNull();
    expect(c.getView().error).toBe('EDGE_ALREADY_USED');
  });

  it('reports reconnecting when snapshots come from cache or RTDB drops', () => {
    const initial = gameDoc();
    const t = fakeTransport();
    const c = new OnlineController(initial, 'me', t.transport);
    t.emitGame({ game: initial, fromCache: true });
    expect(c.getView().connection).not.toBe('connected');
    t.emitGame({ game: initial, fromCache: false });
    expect(c.getView().connection).toBe('connected');
    c.setRealtimeConnected(false);
    expect(c.getView().connection).not.toBe('connected');
  });

  it('claims inactivity for a player offline beyond the grace period', async () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const c = new OnlineController(gameDoc(), 'me', t.transport, 1_000);
    t.emitPlayers([
      { uid: 'me', name: 'Me', color: '#00f', ready: true, joinedAt: 0, connected: true, disconnectedAt: null },
      { uid: 'them', name: 'Them', color: '#f00', ready: true, joinedAt: 0, connected: false, disconnectedAt: Date.now() },
    ]);
    expect(c.getView().disconnectedPlayerIds).toEqual(['them']);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(t.transport.claimInactivity).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(600);
    expect(t.transport.claimInactivity).toHaveBeenCalledWith('them');
    c.dispose();
  });

  it('does not claim inactivity if the player reconnects in time', async () => {
    vi.useFakeTimers();
    const t = fakeTransport();
    const c = new OnlineController(gameDoc(), 'me', t.transport, 1_000);
    const them = { uid: 'them', name: 'Them', color: '#f00', ready: true, joinedAt: 0 };
    t.emitPlayers([{ ...them, connected: false, disconnectedAt: Date.now() }]);
    await vi.advanceTimersByTimeAsync(500);
    t.emitPlayers([{ ...them, connected: true, disconnectedAt: null }]);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(t.transport.claimInactivity).not.toHaveBeenCalled();
    c.dispose();
  });
});
