import { createCpuStrategy, findTurningPoint, generateDailyPuzzle } from '@dots/cpu-engine';
import type { CpuRequest, CpuResponse } from './cpu-protocol';

// Typed narrowly so this file compiles against the DOM lib used by the app.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<CpuRequest>) => void) | null;
  postMessage(message: CpuResponse): void;
};

scope.onmessage = (event) => {
  const request = event.data;
  const { requestId } = request;
  let response: CpuResponse;
  try {
    if (request.kind === 'puzzle') {
      response = { requestId, ok: true, puzzle: generateDailyPuzzle(request.no) };
    } else if (request.kind === 'analyze') {
      const turningPoint = findTurningPoint(request.initial, request.moves, request.playerId);
      response = { requestId, ok: true, turningPoint };
    } else {
      const { state, difficulty, seed, options } = request;
      const edge = createCpuStrategy(difficulty, { ...options, seed }).chooseMove(state);
      response = { requestId, ok: true, edgeId: edge.id };
    }
  } catch (error) {
    response = { requestId, ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(response);
};
