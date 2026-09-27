import { applyMove, createGame, createRng, getValidMoves } from '@dots/game-engine';
import type { GameState, PlayerInit } from '@dots/game-engine';
import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, createCpuStrategy, fromGameState, solveEndgame } from '../src';
import type { Difficulty } from '../src';
import { freeEdges, play, undo } from '../src/model';

const COLORS = ['#2563eb', '#dc2626', '#16a34a', '#d97706'];

function players(n: number): PlayerInit[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `CPU ${i}`,
    type: 'cpu' as const,
    color: COLORS[i]!,
  }));
}

function game(rows: number, columns: number, n = 2, extraTurn = true): GameState {
  return createGame({
    gameId: 't',
    mode: 'cpu',
    level: 0,
    rows,
    columns,
    players: players(n),
    config: { extraTurnOnCapture: extraTurn },
  });
}

/** Play a full game where seat i uses difficulties[i]; returns the final state. */
function playOut(initial: GameState, difficulties: Difficulty[], seed: number): GameState {
  const strategies = difficulties.map((d, i) => createCpuStrategy(d, { seed: seed * 31 + i }));
  let state = initial;
  while (state.status === 'playing') {
    const seat = state.currentPlayerIndex;
    const before = JSON.stringify(state);
    const edge = strategies[seat]!.chooseMove(state);
    expect(JSON.stringify(state)).toBe(before); // strategy never mutates state
    const result = applyMove(state, edge.id, state.players[seat]!.id);
    if (!result.ok) throw new Error(`${difficulties[seat]} chose ${edge.id}: ${result.error}`);
    state = result.gameState;
  }
  return state;
}

describe.each(DIFFICULTIES)('%s strategy', (difficulty) => {
  it('only ever plays valid, unused edges through complete games', () => {
    const sizes: Array<[number, number, number]> = [
      [4, 4, 2],
      [5, 5, 3],
      [3, 6, 4],
      [6, 6, 2],
    ];
    for (const [rows, columns, n] of sizes) {
      for (let seed = 1; seed <= 6; seed++) {
        const final = playOut(game(rows, columns, n), Array(n).fill(difficulty), seed);
        expect(final.status).toBe('finished');
        expect(final.players.reduce((s, p) => s + p.score, 0)).toBe((rows - 1) * (columns - 1));
      }
    }
  });

  it('works with the extra-turn rule disabled', () => {
    const final = playOut(game(4, 4, 2, false), [difficulty, difficulty], 3);
    expect(final.status).toBe('finished');
  });

  it('is deterministic for a given seed', () => {
    const a = playOut(game(5, 5), [difficulty, difficulty], 99);
    const b = playOut(game(5, 5), [difficulty, difficulty], 99);
    expect(a).toEqual(b);
  });

  it('refuses to move in a finished game', () => {
    const final = playOut(game(3, 3), [difficulty, difficulty], 1);
    expect(() => createCpuStrategy(difficulty).chooseMove(final)).toThrow();
  });
});

describe('captures', () => {
  // C-0-0 has three sides; plenty of safe moves remain elsewhere.
  function captureAvailable(): GameState {
    let state = game(5, 5);
    for (const id of ['H-0-0', 'H-4-3', 'V-0-0', 'V-3-4', 'H-1-0']) {
      const r = applyMove(state, id, state.players[state.currentPlayerIndex]!.id);
      if (!r.ok) throw new Error(r.error);
      state = r.gameState;
    }
    return state;
  }

  it.each(['medium', 'hard'] as const)('%s always takes an available cell', (difficulty) => {
    for (let seed = 0; seed < 20; seed++) {
      const edge = createCpuStrategy(difficulty, { seed }).chooseMove(captureAvailable());
      expect(edge.id).toBe('V-0-1');
    }
  });

  it('easy usually takes an available cell', () => {
    let taken = 0;
    for (let seed = 0; seed < 100; seed++) {
      if (createCpuStrategy('easy', { seed }).chooseMove(captureAvailable()).id === 'V-0-1') {
        taken++;
      }
    }
    expect(taken).toBeGreaterThan(60);
  });
});

describe('exact endgame solver', () => {
  /** Plain minimax without memo, for cross-checking on tiny positions. */
  function bruteForce(state: GameState): number {
    const pos = fromGameState(state);
    const rec = (): number => {
      const free = freeEdges(pos);
      if (free.length === 0) return 0;
      let best = -Infinity;
      for (const e of free) {
        const gained = play(pos, e);
        const v = gained > 0 ? gained + rec() : -rec();
        undo(pos, e);
        best = Math.max(best, v);
      }
      return best;
    };
    return rec();
  }

  it('matches brute-force minimax on random small positions', () => {
    const rng = createRng(7);
    for (let trial = 0; trial < 25; trial++) {
      let state = game(4, 4);
      // Leave 7-9 free edges.
      const keep = 7 + rng.int(3);
      while (getValidMoves(state).length > keep && state.status === 'playing') {
        const edge = rng.pick(getValidMoves(state));
        const r = applyMove(state, edge.id, state.players[state.currentPlayerIndex]!.id);
        if (!r.ok) throw new Error(r.error);
        state = r.gameState;
      }
      if (state.status !== 'playing') continue;
      const solved = solveEndgame(fromGameState(state), { extraTurn: true, nodeBudget: 1e7 });
      expect(solved?.margin).toBe(bruteForce(state));
    }
  });

  it('returns null when the node budget is exceeded and leaves the position intact', () => {
    const pos = fromGameState(game(4, 4));
    const before = Array.from(pos.taken).join('');
    expect(solveEndgame(pos, { extraTurn: true, nodeBudget: 10 })).toBeNull();
    expect(Array.from(pos.taken).join('')).toBe(before);
  });
});

describe('strength', () => {
  function winRate(a: Difficulty, b: Difficulty, rows: number, games: number) {
    let wins = 0;
    for (let i = 0; i < games; i++) {
      // Alternate who moves first.
      const seats: Difficulty[] = i % 2 === 0 ? [a, b] : [b, a];
      const aSeat = i % 2 === 0 ? 0 : 1;
      const final = playOut(game(rows, rows), seats, 1000 + i);
      const aId = final.players[aSeat]!.id;
      if (!final.isDraw && final.winnerIds?.includes(aId)) wins++;
    }
    return wins / games;
  }

  it('hard beats easy convincingly', () => {
    expect(winRate('hard', 'easy', 5, 40)).toBeGreaterThan(0.85);
  });

  it('medium beats easy', () => {
    expect(winRate('medium', 'easy', 5, 40)).toBeGreaterThan(0.7);
  });

  it('hard is at least as strong as medium', () => {
    expect(winRate('hard', 'medium', 5, 40)).toBeGreaterThanOrEqual(0.55);
  });
});

describe('performance', () => {
  it('hard picks a move on the largest board quickly at every stage', () => {
    let state = game(12, 12);
    const hard = createCpuStrategy('hard', { seed: 1 });
    let slowest = 0;
    while (state.status === 'playing') {
      const t0 = Date.now();
      const edge = hard.chooseMove(state);
      slowest = Math.max(slowest, Date.now() - t0);
      const r = applyMove(state, edge.id, state.players[state.currentPlayerIndex]!.id);
      if (!r.ok) throw new Error(r.error);
      state = r.gameState;
    }
    // Runs in a Web Worker in the app, but should still be well under a second.
    expect(slowest).toBeLessThan(1000);
  });
});
