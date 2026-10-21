import type { Difficulty, Puzzle, StrategyOptions, TurningPoint } from '@dots/cpu-engine';
import type { GameState, MoveRecord } from '@dots/game-engine';

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
  | { kind: 'puzzle'; requestId: number; no: number }
  | { kind: 'analyze'; requestId: number; initial: GameState; moves: MoveRecord[]; playerId: string };

export type CpuResponse =
  | { requestId: number; ok: true; edgeId: string }
  | { requestId: number; ok: true; puzzle: Puzzle }
  | { requestId: number; ok: true; turningPoint: TurningPoint | null }
  | { requestId: number; ok: false; error: string };
