import { createGame, getCurrentPlayer, replay } from '@dots/game-engine';
import { describe, expect, it } from 'vitest';
import {
  PUZZLE_CPU_ID,
  PUZZLE_HUMAN_ID,
  PUZZLE_SEARCH,
  fromGameState,
  generateDailyPuzzle,
  puzzleNumber,
  solveEndgame,
} from '../src';
import type { Puzzle } from '../src';

function startPosition(puzzle: Puzzle) {
  const initial = createGame({
    gameId: 'p',
    mode: 'cpu',
    level: 0,
    rows: puzzle.rows,
    columns: puzzle.columns,
    ...(puzzle.shape && { shape: puzzle.shape }),
    players: [
      { id: PUZZLE_HUMAN_ID, name: 'You', type: 'human', color: '#000' },
      { id: PUZZLE_CPU_ID, name: 'Nova', type: 'cpu', color: '#111' },
    ],
  });
  const first = initial.players.findIndex((p) => p.id === puzzle.firstPlayerId);
  return replay({ ...initial, currentPlayerIndex: first }, puzzle.initialMoves);
}

describe('daily puzzles', () => {
  // 1–12 are plain boards; 25 and 31–32 are weekend shaped boards.
  const puzzles = [...Array.from({ length: 12 }, (_, i) => i + 1), 25, 31, 32].map(generateDailyPuzzle);

  it('is deterministic', () => {
    expect(generateDailyPuzzle(3)).toEqual(puzzles[2]);
  });

  it('starts on the human turn with nothing scored', () => {
    for (const puzzle of puzzles) {
      const state = startPosition(puzzle);
      expect(state.status).toBe('playing');
      expect(getCurrentPlayer(state)?.id).toBe(PUZZLE_HUMAN_ID);
      expect(state.players.every((p) => p.score === 0)).toBe(true);
    }
  });

  it('has a winning target that the solver confirms within the puzzle search limits', () => {
    for (const puzzle of puzzles) {
      const pos = fromGameState(startPosition(puzzle));
      expect(pos.taken.length - pos.taken.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(
        PUZZLE_SEARCH.exactSearchMaxFreeEdges,
      );
      const solved = solveEndgame(pos, { extraTurn: true, nodeBudget: PUZZLE_SEARCH.exactSearchNodeBudget });
      expect(solved).not.toBeNull();
      expect((puzzle.totalBoxes + solved!.margin) / 2).toBe(puzzle.target);
      expect(puzzle.target * 2).toBeGreaterThan(puzzle.totalBoxes);
    }
  });

  it('shapes weekend puzzles from #25 on, and leaves earlier ones alone', () => {
    expect(generateDailyPuzzle(24).shape).toBeUndefined(); // a Saturday before shapes
    expect(generateDailyPuzzle(25).shape).toBeDefined(); // Sunday
    expect(generateDailyPuzzle(26).shape).toBeUndefined(); // Monday
  });

  it('numbers days in local time from the epoch', () => {
    expect(puzzleNumber(new Date(2026, 9, 1, 0, 5))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 1, 23, 55))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 21, 12))).toBe(21);
  });
});
