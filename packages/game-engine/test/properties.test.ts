import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyResultToStats,
  computeResultSummary,
  createRng,
  edgeCount,
  emptyStats,
  getValidMoves,
  replay,
} from '../src';
import type { GameState, MoveRecord } from '../src';
import { P1, P2, P3, P4, newGame } from './helpers';

function randomPlayout(seed: number, rows: number, columns: number, playerCount: number) {
  const rng = createRng(seed);
  const initial = newGame(rows, columns, [P1, P2, P3, P4].slice(0, playerCount));
  let state: GameState = initial;
  const moves: MoveRecord[] = [];
  let guard = 0;
  while (state.status === 'playing') {
    if (guard++ > 1000) throw new Error('playout did not terminate');
    const edge = rng.pick(getValidMoves(state));
    const playerId = state.players[state.currentPlayerIndex]!.id;
    const result = applyMove(state, edge.id, playerId, { now: 2_000 });
    if (!result.ok) throw new Error(result.error);
    moves.push({ edgeId: edge.id, playerId });
    const scoreBefore = state.players.reduce((s, p) => s + p.score, 0);
    const scoreAfter = result.gameState.players.reduce((s, p) => s + p.score, 0);
    expect(scoreAfter - scoreBefore).toBe(result.scoreGained);
    expect(result.scoreGained).toBeLessThanOrEqual(2);
    state = result.gameState;
  }
  return { initial, state, moves };
}

describe('random legal playouts', () => {
  it('always terminate with consistent scores, ownership and winners', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 31 }),
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 3, max: 8 }),
        fc.integer({ min: 2, max: 4 }),
        (seed, rows, columns, players) => {
          const { initial, state, moves } = randomPlayout(seed, rows, columns, players);
          const cells = Object.values(state.cells);
          expect(state.totalMoves).toBe(edgeCount(rows, columns));
          expect(Object.values(state.edges).every((e) => e.claimedBy)).toBe(true);
          expect(cells.every((c) => c.ownerId)).toBe(true);
          expect(state.players.reduce((s, p) => s + p.score, 0)).toBe(cells.length);
          for (const p of state.players) {
            expect(cells.filter((c) => c.ownerId === p.id)).toHaveLength(p.score);
          }
          const best = Math.max(...state.players.map((p) => p.score));
          expect(state.winnerIds).toEqual(
            state.players.filter((p) => p.score === best).map((p) => p.id),
          );
          expect(state.isDraw).toBe((state.winnerIds ?? []).length > 1);
          expect(replay(initial, moves)).toEqual({ ...state, endedAt: undefined });
        },
      ),
      { numRuns: 150 },
    );
  });
});

describe('stats', () => {
  it('summarises a finished game and folds it into player stats', () => {
    const { state } = randomPlayout(42, 4, 4, 2);
    const summary = computeResultSummary(state);
    expect(summary.durationMs).toBe(1_000);
    expect(summary.players.map((p) => p.cells)).toEqual(state.players.map((p) => p.score));

    const winner = summary.winnerIds[0]!;
    const s1 = applyResultToStats(emptyStats(), summary, winner);
    expect(s1.gamesPlayed).toBe(1);
    expect(s1.byMode.local).toBe(1);
    if (!summary.isDraw) {
      expect(s1.gamesWon).toBe(1);
      expect(s1.currentWinStreak).toBe(1);
      expect(s1.longestWinStreak).toBe(1);
      expect(s1.highestLevel).toBe(1);
      const s2 = applyResultToStats(s1, summary, winner);
      expect(s2.longestWinStreak).toBe(2);
      const loser = summary.players.find((p) => !summary.winnerIds.includes(p.id))!.id;
      const s3 = applyResultToStats(s2, summary, loser);
      expect(s3.currentWinStreak).toBe(0);
      expect(s3.longestWinStreak).toBe(2);
      expect(s3.losses).toBe(1);
    }
    const neutral = applyResultToStats(emptyStats(), summary, null);
    expect(neutral.gamesPlayed).toBe(1);
    expect(neutral.gamesWon).toBe(0);
    expect(neutral.highestScore).toBe(Math.max(...summary.players.map((p) => p.score)));
  });

  it('refuses to summarise an unfinished game', () => {
    expect(() => computeResultSummary(newGame())).toThrow();
  });
});
