import { HttpsError, onCall } from 'firebase-functions/https';
import type { CallableRequest } from 'firebase-functions/https';
import { logger } from 'firebase-functions/logger';
import type { z } from 'zod';
import { REGION, config } from './app';
import { GameError, toHttpsError } from './errors';

export interface AuthedRequest<T> {
  uid: string;
  data: T;
  raw: CallableRequest<unknown>;
}

/**
 * Callable wrapper: requires Firebase Auth, enforces App Check (except in the
 * emulator), validates input with the shared zod schema and maps GameErrors to
 * HttpsErrors with a stable `details.code`.
 */
export function callable<S extends z.ZodType, R>(
  schema: S,
  handler: (request: AuthedRequest<z.output<S>>) => Promise<R>,
) {
  return onCall({ region: REGION, enforceAppCheck: config.enforceAppCheck, cors: true }, async (request) => {
    if (!request.auth) throw toHttpsError(new GameError('UNAUTHENTICATED'));
    const parsed = schema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Invalid request', {
        code: 'INVALID_ARGUMENT',
        issues: parsed.error.issues.map((i) => i.message),
      });
    }
    try {
      return await handler({ uid: request.auth.uid, data: parsed.data, raw: request });
    } catch (error) {
      if (error instanceof GameError) throw toHttpsError(error);
      if (error instanceof HttpsError) throw error;
      logger.error('Unhandled callable error', error);
      throw new HttpsError('internal', 'Something went wrong');
    }
  });
}
