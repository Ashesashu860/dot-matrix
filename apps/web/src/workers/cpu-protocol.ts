import type { Difficulty } from '@dots/cpu-engine';
import type { GameState } from '@dots/game-engine';

export interface CpuRequest {
  requestId: number;
  state: GameState;
  difficulty: Difficulty;
  seed: number;
}

export type CpuResponse =
  | { requestId: number; ok: true; edgeId: string }
  | { requestId: number; ok: false; error: string };
