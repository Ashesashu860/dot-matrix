import { createCpuStrategy, generateDailyPuzzle } from '@dots/cpu-engine';
import type { Difficulty, Puzzle } from '@dots/cpu-engine';
import type { GameState } from '@dots/game-engine';
import type { CpuRequest, CpuResponse, BotOptions } from './cpu-protocol';

/** Computes CPU moves; implementations may run off the main thread. */
export interface CpuRunner {
  choose(state: GameState, difficulty: Difficulty, seed: number, options?: BotOptions): Promise<string>;
  /** Generate the daily puzzle `no` (exact search, so kept off the main thread). */
  puzzle(no: number): Promise<Puzzle>;
  dispose(): void;
}

/** Runs strategies synchronously (tests, or browsers without module workers). */
export function createInlineRunner(): CpuRunner {
  return {
    async choose(state, difficulty, seed, options) {
      return createCpuStrategy(difficulty, { ...options, seed }).chooseMove(state).id;
    },
    async puzzle(no) {
      return generateDailyPuzzle(no);
    },
    dispose() {},
  };
}

type Pending = { resolve(response: CpuResponse & { ok: true }): void; reject(e: Error): void };

/** Runs strategies in a dedicated Web Worker so large-board search never blocks the UI. */
export function createWorkerRunner(): CpuRunner {
  if (typeof Worker === 'undefined') return createInlineRunner();
  let worker: Worker;
  try {
    worker = new Worker(new URL('./cpu.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return createInlineRunner();
  }
  let nextId = 0;
  const pending = new Map<number, Pending>();
  worker.onmessage = (event: MessageEvent<CpuResponse>) => {
    const { requestId } = event.data;
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    if (event.data.ok) entry.resolve(event.data);
    else entry.reject(new Error(event.data.error));
  };
  worker.onerror = (event) => {
    for (const entry of pending.values()) entry.reject(new Error(event.message || 'CPU worker failed'));
    pending.clear();
  };
  const send = (request: CpuRequest) =>
    new Promise<CpuResponse & { ok: true }>((resolve, reject) => {
      pending.set(request.requestId, { resolve, reject });
      worker.postMessage(request);
    });
  return {
    async choose(state, difficulty, seed, options) {
      const response = await send({ kind: 'choose', requestId: ++nextId, state, difficulty, seed, options });
      if (!('edgeId' in response)) throw new Error('Unexpected CPU response');
      return response.edgeId;
    },
    async puzzle(no) {
      const response = await send({ kind: 'puzzle', requestId: ++nextId, no });
      if (!('puzzle' in response)) throw new Error('Unexpected CPU response');
      return response.puzzle;
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}

let shared: CpuRunner | null = null;

/** The app-wide runner: one worker serves every game and puzzle. */
export function sharedRunner(): CpuRunner {
  return (shared ??= createWorkerRunner());
}
