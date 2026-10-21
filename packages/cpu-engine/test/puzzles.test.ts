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
    players: [
      { id: PUZZLE_HUMAN_ID, name: 'You', type: 'human', color: '#000' },
      { id: PUZZLE_CPU_ID, name: 'Nova', type: 'cpu', color: '#111' },
    ],
  });
  const first = initial.players.findIndex((p) => p.id === puzzle.firstPlayerId);
  return replay({ ...initial, currentPlayerIndex: first }, puzzle.initialMoves);
}

describe('daily puzzles', () => {
  const puzzles = Array.from({ length: 12 }, (_, i) => generateDailyPuzzle(i + 1));

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

  it('numbers days in local time from the epoch', () => {
    expect(puzzleNumber(new Date(2026, 9, 1, 0, 5))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 1, 23, 55))).toBe(1);
    expect(puzzleNumber(new Date(2026, 9, 21, 12))).toBe(21);
  });
});
