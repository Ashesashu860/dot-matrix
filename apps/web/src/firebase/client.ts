'use client';

import { CALLABLE_REGION } from '@dots/protocol';
import { getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { ReCaptchaEnterpriseProvider, initializeAppCheck } from 'firebase/app-check';
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
import { connectDatabaseEmulator, getDatabase } from 'firebase/database';
import type { Database } from 'firebase/database';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';
import type { Functions } from 'firebase/functions';

/**
 * Firebase is only loaded by online routes. CPU and local play never import
 * this module, so they work without any Firebase connection.
 */

const env = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  useEmulators: process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true',
  emulatorHost: process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST,
  recaptchaKey: process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY,
  appCheckDebug: process.env.NEXT_PUBLIC_APPCHECK_DEBUG === 'true',
};

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  database: Database;
  functions: Functions;
}

let services: FirebaseServices | null = null;

export function isFirebaseConfigured(): boolean {
  return env.useEmulators || Boolean(env.apiKey && env.projectId);
}

export function getFirebase(): FirebaseServices {
  if (services) return services;
  const projectId = env.projectId || 'demo-dots-matrix';
  // Default to the current hostname so a phone on the LAN can reach the emulators.
  const host = env.emulatorHost || window.location.hostname;
  const app =
    getApps()[0] ??
    initializeApp({
      apiKey: env.apiKey || 'demo-key',
      authDomain: env.authDomain || `${projectId}.firebaseapp.com`,
      projectId,
      storageBucket: env.storageBucket,
      messagingSenderId: env.messagingSenderId,
      appId: env.appId,
      databaseURL:
        env.databaseURL ||
        (env.useEmulators ? `http://${host}:9000?ns=${projectId}` : `https://${projectId}-default-rtdb.firebaseio.com`),
    });

  if (env.recaptchaKey) {
    if (env.useEmulators || env.appCheckDebug) {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(env.recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  const auth = getAuth(app);
  const firestore = getFirestore(app);
  const database = getDatabase(app);
  const functions = getFunctions(app, CALLABLE_REGION);
  if (env.useEmulators) {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(firestore, host, 8080);
    connectDatabaseEmulator(database, host, 9000);
    connectFunctionsEmulator(functions, host, 5001);
  }
  services = { app, auth, firestore, database, functions };
  return services;
}

/** Anonymous guest identity (§6.2); the same UID survives reloads for reconnection. */
export function ensureSignedIn(): Promise<User> {
  const { auth } = getFirebase();
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        if (user) resolve(user);
        else signInAnonymously(auth).then((cred) => resolve(cred.user), reject);
      },
      reject,
    );
  });
}
