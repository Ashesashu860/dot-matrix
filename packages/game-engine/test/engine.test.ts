import { describe, expect, it } from 'vitest';
import {
  LEVELS,
  applyMove,
  cellCount,
  createGame,
  edgeCount,
  edgeIdBetweenDots,
  findCompletedCells,
  forfeitPlayer,
  generateBoard,
  getNextPlayer,
  getValidMoves,
  getWinner,
  isGameOver,
  isValidMove,
  parseEdgeId,
  replay,
} from '../src';
import { P1, P2, P3, P4, newGame, play, withClaimed } from './helpers';

describe('board generation', () => {
  it.each(LEVELS.map((l) => [l.level, l.rows, l.columns] as const))(
    'level %i (%ix%i) has correct edge and cell counts',
    (_level, rows, columns) => {
      const { edges, cells } = generateBoard(rows, columns);
      expect(Object.keys(edges)).toHaveLength(edgeCount(rows, columns));
      expect(Object.keys(cells)).toHaveLength(cellCount(rows, columns));
      expect(Object.keys(cells)).toHaveLength((rows - 1) * (columns - 1));
    },
  );

  it('supports non-square boards', () => {
    const { edges, cells } = generateBoard(3, 6);
    expect(Object.keys(cells)).toHaveLength(2 * 5);
    expect(Object.keys(edges)).toHaveLength(3 * 5 + 2 * 6);
  });

  it('wires each cell to its four edges', () => {
    const { cells, edges } = generateBoard(4, 4);
    expect(cells['C-1-2']).toMatchObject({
      top: 'H-1-2',
      bottom: 'H-2-2',
      left: 'V-1-2',
      right: 'V-1-3',
    });
    for (const cell of Object.values(cells)) {
      for (const side of [cell.top, cell.right, cell.bottom, cell.left]) {
        expect(edges[side]).toBeDefined();
      }
    }
  });

  it('rejects unsupported sizes', () => {
    expect(() => generateBoard(2, 4)).toThrow(RangeError);
    expect(() => generateBoard(51, 4)).toThrow(RangeError);
    expect(() => generateBoard(4.5, 4)).toThrow(RangeError);
  });

  it('createGame is deterministic and validates players', () => {
    expect(newGame()).toEqual(newGame());
    expect(() => newGame(4, 4, [P1])).toThrow();
    expect(() => newGame(4, 4, [P1, P2, P3, P4, { ...P4, id: 'p5' }])).toThrow();
    expect(() => newGame(4, 4, [P1, P1])).toThrow();
    const g = newGame(4, 4, [P1, P2, P3]);
    expect(g.players.every((p) => p.score === 0 && p.active)).toBe(true);
    expect(g.config.extraTurnOnCapture).toBe(true);
    expect(g.status).toBe('playing');
  });
});

describe('move validation', () => {
  it('accepts adjacent horizontal and vertical dot connections', () => {
    expect(edgeIdBetweenDots({ row: 0, column: 0 }, { row: 0, column: 1 }, 4, 4)).toBe('H-0-0');
    expect(edgeIdBetweenDots({ row: 2, column: 3 }, { row: 2, column: 2 }, 4, 4)).toBe('H-2-2');
    expect(edgeIdBetweenDots({ row: 1, column: 3 }, { row: 2, column: 3 }, 4, 4)).toBe('V-1-3');
    expect(edgeIdBetweenDots({ row: 3, column: 0 }, { row: 2, column: 0 }, 4, 4)).toBe('V-2-0');
  });

  it('rejects diagonal, long, identical and off-board connections', () => {
    expect(edgeIdBetweenDots({ row: 0, column: 0 }, { row: 1, column: 1 }, 4, 4)).toBeNull();
    expect(edgeIdBetweenDots({ row: 0, column: 0 }, { row: 0, column: 2 }, 4, 4)).toBeNull();
    expect(edgeIdBetweenDots({ row: 0, column: 0 }, { row: 2, column: 0 }, 4, 4)).toBeNull();
    expect(edgeIdBetweenDots({ row: 1, column: 1 }, { row: 1, column: 1 }, 4, 4)).toBeNull();
    expect(edgeIdBetweenDots({ row: 3, column: 3 }, { row: 3, column: 4 }, 4, 4)).toBeNull();
    expect(edgeIdBetweenDots({ row: -1, column: 0 }, { row: 0, column: 0 }, 4, 4)).toBeNull();
  });

  it.each([
    'H-0-3', // past the last column for horizontals
    'V-3-0', // past the last row for verticals
    'H--1-0',
    'D-0-0',
    'H-0',
    'H-00-1',
    'h-0-0',
    '',
    'H-0-0 ',
  ])('rejects malformed or out-of-range edge id %j', (id) => {
    const game = newGame();
    expect(parseEdgeId(id, 4, 4)).toBeNull();
    expect(isValidMove(game, id)).toBe(false);
    const result = applyMove(game, id, 'p1');
    expect(result).toEqual({ ok: false, error: 'INVALID_EDGE' });
  });

  it('rejects an edge that is already claimed', () => {
    const { gameState } = play(newGame(), ['H-0-0']);
    expect(isValidMove(gameState, 'H-0-0')).toBe(false);
    expect(applyMove(gameState, 'H-0-0', 'p2')).toEqual({
      ok: false,
      error: 'EDGE_ALREADY_USED',
    });
  });

  it('rejects moves out of turn, by unknown players and after the game ends', () => {
    const game = newGame();
    expect(applyMove(game, 'H-0-0', 'p2')).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    expect(applyMove(game, 'H-0-0', 'ghost')).toEqual({ ok: false, error: 'UNKNOWN_PLAYER' });
    const finished = { ...game, status: 'finished' as const };
    expect(applyMove(finished, 'H-0-0', 'p1')).toEqual({ ok: false, error: 'GAME_NOT_PLAYING' });
    expect(getValidMoves(finished)).toEqual([]);
  });

  it('getValidMoves shrinks as edges are claimed', () => {
    const game = newGame();
    expect(getValidMoves(game)).toHaveLength(24);
    const { gameState } = play(game, ['H-0-0', 'V-1-1']);
    const ids = getValidMoves(gameState).map((e) => e.id);
    expect(ids).toHaveLength(22);
    expect(ids).not.toContain('H-0-0');
    expect(ids).not.toContain('V-1-1');
  });

  it('never mutates the input state', () => {
    const game = newGame();
    const snapshot = JSON.parse(JSON.stringify(game)) as typeof game;
    play(game, ['H-0-0', 'V-0-0', 'H-1-0', 'V-0-1']);
    expect(game).toEqual(snapshot);
  });
});

describe('cell detection and scoring', () => {
  it('completes a single cell and awards it to the mover', () => {
    const result = play(newGame(), ['H-0-0', 'V-0-0', 'H-1-0', 'V-0-1']);
    // p1, p2, p1, p2 -> p2 draws the fourth side.
    expect(result.completedCells).toEqual(['C-0-0']);
    expect(result.scoreGained).toBe(1);
    expect(result.gameState.cells['C-0-0']?.ownerId).toBe('p2');
    expect(result.gameState.players.map((p) => p.score)).toEqual([0, 1]);
    expect(result.gameState.lastMove).toEqual({
      edgeId: 'V-0-1',
      playerId: 'p2',
      completedCells: ['C-0-0'],
    });
  });

  it('completes two neighbouring cells with one edge', () => {
    const setup = ['H-0-0', 'H-1-0', 'V-0-0', 'H-0-1', 'H-1-1', 'V-0-2'];
    const before = play(newGame(), setup);
    expect(before.gameState.players.map((p) => p.score)).toEqual([0, 0]);
    const result = play(before.gameState, ['V-0-1']);
    expect(result.completedCells.sort()).toEqual(['C-0-0', 'C-0-1']);
    expect(result.scoreGained).toBe(2);
    expect(result.gameState.players[0]?.score).toBe(2);
    expect(result.gameState.cells['C-0-0']?.ownerId).toBe('p1');
    expect(result.gameState.cells['C-0-1']?.ownerId).toBe('p1');
  });

  it('findCompletedCells only reports newly completed, unowned cells', () => {
    const game = withClaimed(newGame(), ['H-0-0', 'V-0-0', 'H-1-0', 'V-0-1']);
    expect(findCompletedCells(game, 'V-0-1')).toEqual(['C-0-0']);
    const owned = { ...game, cells: { ...game.cells, 'C-0-0': { ...game.cells['C-0-0']!, ownerId: 'p1' } } };
    expect(findCompletedCells(owned, 'V-0-1')).toEqual([]);
    expect(findCompletedCells(game, 'nope')).toEqual([]);
  });
});

describe('turns', () => {
  it('passes the turn when no cell is completed', () => {
    const result = play(newGame(4, 4, [P1, P2, P3]), ['H-0-0']);
    expect(result.extraTurn).toBe(false);
    expect(result.gameState.currentPlayerIndex).toBe(1);
    const after = play(result.gameState, ['H-0-1', 'H-0-2']);
    expect(after.gameState.currentPlayerIndex).toBe(0);
  });

  it('grants an extra turn after a capture by default', () => {
    const result = play(newGame(), ['H-0-0', 'V-0-0', 'H-1-0', 'V-0-1']);
    expect(result.extraTurn).toBe(true);
    expect(result.gameState.currentPlayerIndex).toBe(1); // still p2
  });

  it('respects extraTurnOnCapture = false', () => {
    const game = newGame(4, 4, [P1, P2], { config: { extraTurnOnCapture: false } });
    const result = play(game, ['H-0-0', 'V-0-0', 'H-1-0', 'V-0-1']);
    expect(result.completedCells).toEqual(['C-0-0']);
    expect(result.extraTurn).toBe(false);
    expect(result.gameState.currentPlayerIndex).toBe(0);
  });

  it('getNextPlayer skips inactive players', () => {
    const game = newGame(4, 4, [P1, P2, P3]);
    const withInactive = {
      ...game,
      players: game.players.map((p) => (p.id === 'p2' ? { ...p, active: false } : p)),
    };
    expect(getNextPlayer(withInactive, false)).toBe(2);
    expect(getNextPlayer({ ...withInactive, currentPlayerIndex: 2 }, false)).toBe(0);
  });
});

describe('end of game', () => {
  const allEdges3x3 = Object.keys(generateBoard(3, 3).edges);

  it('ends immediately on the final cell without creating another turn', () => {
    const game = newGame(3, 3);
    const last = 'V-1-2';
    const setup = withClaimed(
      game,
      allEdges3x3.filter((id) => id !== last),
    );
    // Give three cells to p1/p2 so the final capture decides the result.
    const cells = { ...setup.cells };
    cells['C-0-0'] = { ...cells['C-0-0']!, ownerId: 'p1' };
    cells['C-0-1'] = { ...cells['C-0-1']!, ownerId: 'p2' };
    cells['C-1-0'] = { ...cells['C-1-0']!, ownerId: 'p2' };
    const players = setup.players.map((p) => ({ ...p, score: p.id === 'p1' ? 1 : 2 }));
    const state = { ...setup, cells, players, currentPlayerIndex: 0 };

    const result = applyMove(state, last, 'p1', { now: 9_000 });
    if (!result.ok) throw new Error(result.error);
    expect(result.gameOver).toBe(true);
    expect(result.extraTurn).toBe(false);
    expect(result.gameState.status).toBe('finished');
    expect(result.gameState.endedAt).toBe(9_000);
    expect(result.gameState.currentPlayerIndex).toBe(0);
    expect(result.gameState.isDraw).toBe(true);
    expect(result.gameState.winnerIds?.sort()).toEqual(['p1', 'p2']);
    expect(getValidMoves(result.gameState)).toEqual([]);
  });

  it('declares the highest score the winner', () => {
    const game = newGame(4, 4, [P1, P2, P3]);
    const players = game.players.map((p, i) => ({ ...p, score: [2, 5, 1][i]! }));
    expect(getWinner({ players })).toEqual({ winnerIds: ['p2'], isDraw: false });
  });

  it('reports a draw for equal highest scores', () => {
    const game = newGame(4, 4, [P1, P2, P3]);
    const players = game.players.map((p, i) => ({ ...p, score: [4, 4, 1][i]! }));
    expect(getWinner({ players })).toEqual({ winnerIds: ['p1', 'p2'], isDraw: true });
  });

  it('isGameOver is false while cells remain', () => {
    expect(isGameOver(newGame())).toBe(false);
  });

  it('plays a full 3x3 game where every edge is used exactly once', () => {
    const result = play(newGame(3, 3), allEdges3x3, 5_000);
    const state = result.gameState;
    expect(result.gameOver).toBe(true);
    expect(state.status).toBe('finished');
    expect(state.totalMoves).toBe(12);
    expect(state.players.reduce((s, p) => s + p.score, 0)).toBe(4);
    expect(Object.values(state.cells).every((c) => c.ownerId)).toBe(true);
  });
});

describe('forfeit', () => {
  it('skips a forfeited player and advances the turn if it was theirs', () => {
    const game = newGame(4, 4, [P1, P2, P3]);
    const next = forfeitPlayer(game, 'p1');
    expect(next.players[0]?.active).toBe(false);
    expect(next.currentPlayerIndex).toBe(1);
    expect(next.status).toBe('playing');
    expect(applyMove(next, 'H-0-0', 'p1')).toEqual({ ok: false, error: 'UNKNOWN_PLAYER' });
  });

  it('ends the game when only one player remains, who wins', () => {
    const next = forfeitPlayer(newGame(), 'p2', { now: 7 });
    expect(next.status).toBe('finished');
    expect(next.winnerIds).toEqual(['p1']);
    expect(next.endedAt).toBe(7);
  });

  it('is a no-op for unknown or already inactive players', () => {
    const game = newGame(4, 4, [P1, P2, P3]);
    expect(forfeitPlayer(game, 'ghost')).toBe(game);
    const once = forfeitPlayer(game, 'p3');
    expect(forfeitPlayer(once, 'p3')).toBe(once);
  });
});

describe('replay', () => {
  it('reproduces the same state from move history', () => {
    const game = createGame({
      gameId: 'r',
      mode: 'online',
      level: 1,
      rows: 4,
      columns: 4,
      players: [P1, P2],
    });
    const ids = ['H-0-0', 'V-0-0', 'H-1-0', 'V-0-1', 'H-3-2'];
    const moves: { edgeId: string; playerId: string }[] = [];
    let state = game;
    for (const id of ids) {
      const playerId = state.players[state.currentPlayerIndex]!.id;
      moves.push({ edgeId: id, playerId });
      const r = applyMove(state, id, playerId);
      if (!r.ok) throw new Error(r.error);
      state = r.gameState;
    }
    expect(replay(game, moves)).toEqual(state);
  });

  it('throws on an illegal move', () => {
    expect(() => replay(newGame(), [{ edgeId: 'H-0-0', playerId: 'p2' }])).toThrow(
      /NOT_YOUR_TURN/,
    );
  });
});
