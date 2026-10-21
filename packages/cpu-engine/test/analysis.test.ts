import { applyMove, createGame, replay } from '@dots/game-engine';
import type { MoveRecord } from '@dots/game-engine';
import { describe, expect, it } from 'vitest';
import { PUZZLE_CPU_ID, PUZZLE_HUMAN_ID, createCpuStrategy, findTurningPoint, generateDailyPuzzle } from '../src';

function puzzleStart(no: number) {
  const puzzle = generateDailyPuzzle(no);
  const initial = createGame({
    gameId: 'a',
    mode: 'cpu',
    level: 0,
    rows: puzzle.rows,
    columns: puzzle.columns,
    players: [
      { id: PUZZLE_HUMAN_ID, name: 'You', type: 'human', color: '#000' },
      { id: PUZZLE_CPU_ID, name: 'Nova', type: 'cpu', color: '#111' },
    ],
  });
  const first = initial.players.findIndex((p) => p.id === puzzle.firstPlayerId);
  return { puzzle, start: replay({ ...initial, currentPlayerIndex: first }, puzzle.initialMoves) };
}

/** Play out from `start`: the human uses `human`, the bot plays perfectly. */
function playOut(start: ReturnType<typeof puzzleStart>['start'], human: 'medium' | 'hard') {
  const strategies: Record<string, ReturnType<typeof createCpuStrategy>> = {
    [PUZZLE_HUMAN_ID]: createCpuStrategy(human, { seed: 1, exactSearchMaxFreeEdges: 19 }),
    [PUZZLE_CPU_ID]: createCpuStrategy('hard', { seed: 2, exactSearchMaxFreeEdges: 19 }),
  };
  const moves: MoveRecord[] = [];
  let state = start;
  while (state.status === 'playing') {
    const playerId = state.players[state.currentPlayerIndex]!.id;
    const edgeId = strategies[playerId]!.chooseMove(state).id;
    const result = applyMove(state, edgeId, playerId);
    if (!result.ok) throw new Error(result.error);
    moves.push({ edgeId, playerId });
    state = result.gameState;
  }
  return moves;
}

describe('findTurningPoint', () => {
  it('finds nothing to fix in perfect play', () => {
    const { start } = puzzleStart(2);
    expect(findTurningPoint(start, playOut(start, 'hard'), PUZZLE_HUMAN_ID)).toBeNull();
  });

  it('pins the naive move in a puzzle built to punish it', () => {
    // Daily puzzles only accept positions where the obvious first move loses boxes.
    const { start } = puzzleStart(5);
    const moves = playOut(start, 'medium');
    const point = findTurningPoint(start, moves, PUZZLE_HUMAN_ID);
    expect(point).not.toBeNull();
    expect(point!.boxes).toBeGreaterThan(0);
    expect(point!.better).not.toBe(point!.played);
    expect(point!.state.players[point!.state.currentPlayerIndex]!.id).toBe(PUZZLE_HUMAN_ID);
  });
});
