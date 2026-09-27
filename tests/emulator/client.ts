import { CALLABLE_REGION } from '@dots/protocol';
import type { CallableName, ProtocolErrorCode } from '@dots/protocol';
import { deleteApp, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import type { Database } from 'firebase/database';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';
import type { Functions } from 'firebase/functions';

export const PROJECT_ID = 'demo-dots-matrix';

let counter = 0;

export interface TestPlayer {
  uid: string;
  app: FirebaseApp;
  firestore: Firestore;
  database: Database;
  functions: Functions;
  call<T = unknown>(name: CallableName, data?: unknown): Promise<T>;
  dispose(): Promise<void>;
}

/** An independent signed-in (anonymous) client, like a separate browser. */
export async function newPlayer(): Promise<TestPlayer> {
  const app = initializeApp(
    {
      apiKey: 'demo-key',
      projectId: PROJECT_ID,
      authDomain: `${PROJECT_ID}.firebaseapp.com`,
      databaseURL: `http://127.0.0.1:9000?ns=${PROJECT_ID}`,
    },
    `player-${++counter}-${Date.now()}`,
  );
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  const database = getDatabase(app);
  connectDatabaseEmulator(database, '127.0.0.1', 9000);
  const functions = getFunctions(app, CALLABLE_REGION);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const { user } = await signInAnonymously(auth);
  return {
    uid: user.uid,
    app,
    firestore,
    database,
    functions,
    async call<T>(name: CallableName, data: unknown = {}) {
      const result = await httpsCallable(functions, name)(data);
      return result.data as T;
    },
    dispose: () => deleteApp(app),
  };
}

/** Assert a callable rejects with the given protocol error code. */
export async function expectCode(promise: Promise<unknown>, code: ProtocolErrorCode) {
  try {
    await promise;
  } catch (error) {
    const actual = (error as { details?: { code?: string } }).details?.code;
    if (actual === code) return;
    throw new Error(`Expected ${code}, got ${actual ?? String(error)}`);
  }
  throw new Error(`Expected ${code}, but the call succeeded`);
}

export async function waitFor<T>(fn: () => Promise<T | undefined | null | false>, timeoutMs = 10_000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 150));
  }
}
