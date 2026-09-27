import { applyMove, createGame, getCurrentPlayer } from '../src/engine';
import type { GameState, MoveSuccess } from '../src/types';
import type { PlayerInit } from '../src/engine';

export const P1: PlayerInit = { id: 'p1', name: 'Ada', type: 'human', color: '#2563eb' };
export const P2: PlayerInit = { id: 'p2', name: 'Bob', type: 'human', color: '#dc2626' };
export const P3: PlayerInit = { id: 'p3', name: 'Cy', type: 'human', color: '#16a34a' };
export const P4: PlayerInit = { id: 'p4', name: 'Di', type: 'human', color: '#d97706' };

export function newGame(
  rows = 4,
  columns = 4,
  players: PlayerInit[] = [P1, P2],
  extra: Partial<Parameters<typeof createGame>[0]> = {},
): GameState {
  return createGame({
    gameId: 'g1',
    mode: 'local',
    level: 1,
    rows,
    columns,
    players,
    startedAt: 1_000,
    ...extra,
  });
}

/** Play edges in order, each by whoever's turn it is. Throws on rejection. */
export function play(state: GameState, edgeIds: string[], now?: number): MoveSuccess {
  let last: MoveSuccess | undefined;
  let current = state;
  for (const id of edgeIds) {
    const player = getCurrentPlayer(current);
    if (!player) throw new Error('No current player');
    const result = applyMove(current, id, player.id, now === undefined ? {} : { now });
    if (!result.ok) throw new Error(`${id} rejected: ${result.error}`);
    last = result;
    current = result.gameState;
  }
  if (!last) throw new Error('No moves played');
  return last;
}

/** Mark edges as claimed without scoring (to build scenarios quickly). */
export function withClaimed(state: GameState, ids: string[], by = 'p1'): GameState {
  const edges = { ...state.edges };
  for (const id of ids) {
    const edge = edges[id];
    if (!edge) throw new Error(`Unknown edge ${id}`);
    edges[id] = { ...edge, claimedBy: by };
  }
  return { ...state, edges };
}
