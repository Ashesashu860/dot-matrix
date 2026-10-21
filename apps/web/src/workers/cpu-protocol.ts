import type { Difficulty, Puzzle, StrategyOptions } from '@dots/cpu-engine';
import type { GameState } from '@dots/game-engine';

/** Strategy tuning a game may set (search limits, Easy's mistake rates); the seed is passed separately. */
export type BotOptions = Omit<StrategyOptions, 'seed'>;

export type CpuRequest =
  | {
      kind: 'choose';
      requestId: number;
      state: GameState;
      difficulty: Difficulty;
      seed: number;
      options?: BotOptions;
    }
  | { kind: 'puzzle'; requestId: number; no: number };

export type CpuResponse =
  | { requestId: number; ok: true; edgeId: string }
  | { requestId: number; ok: true; puzzle: Puzzle }
  | { requestId: number; ok: false; error: string };
