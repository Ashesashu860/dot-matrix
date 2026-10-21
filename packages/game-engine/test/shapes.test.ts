import { describe, expect, it } from 'vitest';
import {
  GOLD_VALUE,
  SHAPES,
  SHAPE_IDS,
  WALL_ID,
  applyMove,
  createRng,
  generateBoard,
  getValidMoves,
  shapeCells,
  shapeSize,
  totalPoints,
} from '../src';
import type { GameState } from '../src';
import { P1, P2, P3, newGame } from './helpers';

function shapedGame(id: keyof typeof SHAPES, players = [P1, P2]) {
  const { rows, columns } = shapeSize(SHAPES[id]);
  return newGame(rows, columns, players, { shape: id });
}

describe('shaped boards', () => {
  it.each(SHAPE_IDS)('%s: holes, walls and gold match the art', (id) => {
    const shape = SHAPES[id];
    const { rows, columns } = shapeSize(shape);
    const { cells, edges } = generateBoard(rows, columns, id);
    const values = shapeCells(shape);
    expect(Object.keys(cells).sort()).toEqual([...values.keys()].sort());
    for (const [cid, value] of values) expect(cells[cid]!.value ?? 1).toBe(value);
    // Every edge borders a box, and every box's sides exist.
    for (const cell of Object.values(cells)) {
      for (const e of [cell.top, cell.right, cell.bottom, cell.left]) expect(edges[e]).toBeDefined();
      // No box starts one line from capture.
      const walled = [cell.top, cell.right, cell.bottom, cell.left].filter((e) => edges[e]!.claimedBy === WALL_ID);
      expect(walled.length).toBeLessThanOrEqual(2);
    }
    const walls = Object.values(edges).filter((e) => e.claimedBy === WALL_ID).map((e) => e.id);
    expect(walls.sort()).toEqual([...('walls' in shape ? shape.walls : [])].sort());
  });

  it.each(SHAPE_IDS)('%s: random games end with every point scored', (id) => {
    for (let seed = 1; seed <= 20; seed++) {
      const rng = createRng(seed);
      let state: GameState = shapedGame(id, seed % 2 ? [P1, P2] : [P1, P2, P3]);
      const points = totalPoints(state);
      while (state.status === 'playing') {
        const result = applyMove(state, rng.pick(getValidMoves(state)).id, state.players[state.currentPlayerIndex]!.id);
        if (!result.ok) throw new Error(result.error);
        state = result.gameState;
      }
      expect(Object.values(state.cells).every((c) => c.ownerId)).toBe(true);
      expect(state.players.reduce((s, p) => s + p.score, 0)).toBe(points);
      expect(state.shape).toBe(id);
    }
  });

  it('a gold box scores its value', () => {
    // Mini cross: C-1-1 is gold.
    let state = shapedGame('mini');
    expect(state.cells['C-1-1']!.value).toBe(GOLD_VALUE);
    for (const edge of ['H-1-1', 'V-1-1', 'V-1-2']) {
      const r = applyMove(state, edge, state.players[state.currentPlayerIndex]!.id);
      if (!r.ok) throw new Error(r.error);
      state = r.gameState;
    }
    const mover = state.players[state.currentPlayerIndex]!;
    const r = applyMove(state, 'H-2-1', mover.id);
    if (!r.ok) throw new Error(r.error);
    expect(r.completedCells).toEqual(['C-1-1']);
    expect(r.scoreGained).toBe(GOLD_VALUE);
    expect(r.gameState.players.find((p) => p.id === mover.id)!.score).toBe(GOLD_VALUE);
  });

  it('walls cannot be drawn and holes have no lines', () => {
    const state = shapedGame('vault');
    expect(applyMove(state, 'H-1-2', 'p1')).toEqual({ ok: false, error: 'EDGE_ALREADY_USED' });
    const cross = shapedGame('cross');
    expect(cross.edges['H-0-0']).toBeUndefined();
    expect(applyMove(cross, 'H-0-0', 'p1')).toEqual({ ok: false, error: 'INVALID_EDGE' });
  });

  it('rejects unknown shapes and mismatched sizes', () => {
    expect(() => generateBoard(5, 5, 'nope')).toThrow(RangeError);
    expect(() => generateBoard(4, 4, 'cross')).toThrow(RangeError);
  });
});
