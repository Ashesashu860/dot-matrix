import { createCpuStrategy } from '@dots/cpu-engine';
import type { Difficulty } from '@dots/cpu-engine';
import type { GameState } from '@dots/game-engine';
import type { CpuRequest, CpuResponse } from './cpu-protocol';

/** Computes CPU moves; implementations may run off the main thread. */
export interface CpuRunner {
  choose(state: GameState, difficulty: Difficulty, seed: number): Promise<string>;
  dispose(): void;
}

/** Runs strategies synchronously (tests, or browsers without module workers). */
export function createInlineRunner(): CpuRunner {
  return {
    async choose(state, difficulty, seed) {
      return createCpuStrategy(difficulty, { seed }).chooseMove(state).id;
    },
    dispose() {},
  };
}

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
  const pending = new Map<number, { resolve(id: string): void; reject(e: Error): void }>();
  worker.onmessage = (event: MessageEvent<CpuResponse>) => {
    const { requestId } = event.data;
    const entry = pending.get(requestId);
    if (!entry) return;
    pending.delete(requestId);
    if (event.data.ok) entry.resolve(event.data.edgeId);
    else entry.reject(new Error(event.data.error));
  };
  worker.onerror = (event) => {
    for (const entry of pending.values()) entry.reject(new Error(event.message || 'CPU worker failed'));
    pending.clear();
  };
  return {
    choose(state, difficulty, seed) {
      const requestId = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        const request: CpuRequest = { requestId, state, difficulty, seed };
        worker.postMessage(request);
      });
    },
    dispose() {
      worker.terminate();
      pending.clear();
    },
  };
}
