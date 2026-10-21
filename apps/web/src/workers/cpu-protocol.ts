import type { Difficulty, Puzzle, StrategyOptions } from '@dots/cpu-engine';
import type { GameState } from '@dots/game-engine';

/** Search limits a game may raise (puzzles); the seed is passed separately. */
export type SearchOptions = Pick<StrategyOptions, 'exactSearchMaxFreeEdges' | 'exactSearchNodeBudget'>;

export type CpuRequest =
  | {
      kind: 'choose';
      requestId: number;
      state: GameState;
      difficulty: Difficulty;
      seed: number;
      options?: SearchOptions;
    }
  | { kind: 'puzzle'; requestId: number; no: number };

export type CpuResponse =
  | { requestId: number; ok: true; edgeId: string }
  | { requestId: number; ok: true; puzzle: Puzzle }
  | { requestId: number; ok: false; error: string };
