import { ERROR_MESSAGES } from '@dots/protocol';
import type { ProtocolErrorCode } from '@dots/protocol';
import { HttpsError } from 'firebase-functions/https';
import type { FunctionsErrorCode } from 'firebase-functions/https';

/** A domain error with a stable protocol code, surfaced to clients in `details.code`. */
export class GameError extends Error {
  constructor(readonly code: ProtocolErrorCode) {
    super(ERROR_MESSAGES[code]);
  }
}

const HTTPS_CODE: Partial<Record<ProtocolErrorCode, FunctionsErrorCode>> = {
  UNAUTHENTICATED: 'unauthenticated',
  INVALID_ARGUMENT: 'invalid-argument',
  RATE_LIMITED: 'resource-exhausted',
  ROOM_NOT_FOUND: 'not-found',
  GAME_NOT_FOUND: 'not-found',
  NOT_HOST: 'permission-denied',
  NOT_IN_ROOM: 'permission-denied',
  UNKNOWN_PLAYER: 'permission-denied',
  ROOM_FULL: 'failed-precondition',
  STALE_STATE: 'aborted',
  EDGE_ALREADY_USED: 'already-exists',
};

export function toHttpsError(error: GameError): HttpsError {
  return new HttpsError(HTTPS_CODE[error.code] ?? 'failed-precondition', error.message, { code: error.code });
}
