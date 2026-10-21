import { PUZZLE_HUMAN_ID, PUZZLE_SEARCH, fromGameState, solveEndgame } from '@dots/cpu-engine';
import { cellCount } from '@dots/game-engine';
import { describe, expect, it } from 'vitest';
import { newLocalGame } from '@/controllers/local-controller';
import { LESSONS } from './lessons';
import { puzzleSetup } from './puzzle-setup';

describe('lessons', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))('%s: the human moves and the target is perfect play', (_, lesson) => {
    const state = newLocalGame(puzzleSetup(lesson.position, 1), 'g', 0);
    expect(state.players[state.currentPlayerIndex]?.id).toBe(PUZZLE_HUMAN_ID);
    expect(state.players.every((p) => p.score === 0)).toBe(true);
    expect(cellCount(lesson.position.rows, lesson.position.columns)).toBe(lesson.totalBoxes);
    const solved = solveEndgame(fromGameState(state), { extraTurn: true, nodeBudget: PUZZLE_SEARCH.exactSearchNodeBudget });
    expect(solved).not.toBeNull();
    expect((lesson.totalBoxes + solved!.margin) / 2).toBe(lesson.target);
  });
});
