import { createCpuStrategy } from '@dots/cpu-engine';
import type { CpuRequest, CpuResponse } from './cpu-protocol';

// Typed narrowly so this file compiles against the DOM lib used by the app.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CpuRequest>) => void) | null;
  postMessage(message: CpuResponse): void;
};

scope.onmessage = (event) => {
  const { requestId, state, difficulty, seed } = event.data;
  let response: CpuResponse;
  try {
    const edge = createCpuStrategy(difficulty, { seed }).chooseMove(state);
    response = { requestId, ok: true, edgeId: edge.id };
  } catch (error) {
    response = { requestId, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(response);
};
