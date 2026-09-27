import { getApps, initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';
import { CALLABLE_REGION, PRESENCE_GRACE_MS } from '@dots/protocol';

if (getApps().length === 0) initializeApp();

export const db = getFirestore();
// Engine state uses optional fields; skip undefined rather than rejecting writes.
db.settings({ ignoreUndefinedProperties: true });

export const rtdb = () => getDatabase();

export const REGION = CALLABLE_REGION;

export const config = {
  enforceAppCheck: process.env.ENFORCE_APP_CHECK !== 'false',
  presenceGraceMs: Number(process.env.PRESENCE_GRACE_MS ?? PRESENCE_GRACE_MS),
};

export const now = () => Date.now();
