import type { GameDoc, MoveDoc, PlayerStatsDoc, RoomDoc, RoomPlayerDoc } from '@dots/protocol';
import type { CollectionReference, DocumentReference } from 'firebase-admin/firestore';
import { db } from './app';

export const roomRef = (roomId: string) => db.doc(`rooms/${roomId}`) as DocumentReference<RoomDoc>;
export const roomPlayersRef = (roomId: string) =>
  db.collection(`rooms/${roomId}/players`) as CollectionReference<RoomPlayerDoc>;
export const roomPlayerRef = (roomId: string, uid: string) =>
  db.doc(`rooms/${roomId}/players/${uid}`) as DocumentReference<RoomPlayerDoc>;
export const roomCodeRef = (code: string) => db.doc(`roomCodes/${code}`) as DocumentReference<{ roomId: string; createdAt: number }>;
export const gameRef = (gameId: string) => db.doc(`games/${gameId}`) as DocumentReference<GameDoc>;
export const moveRef = (gameId: string, id: string) => db.doc(`games/${gameId}/moves/${id}`) as DocumentReference<MoveDoc>;
export const statsRef = (uid: string) => db.doc(`playerStats/${uid}`) as DocumentReference<PlayerStatsDoc>;
export const rateLimitRef = (uid: string, key: string) =>
  db.doc(`rateLimits/${uid}_${key}`) as DocumentReference<{ tokens: number; updatedAt: number }>;
