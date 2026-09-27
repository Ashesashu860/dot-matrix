'use client';

import type { GameDoc, RoomPlayerDoc } from '@dots/protocol';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import type { OnlineTransport } from '@/controllers/online-controller';
import { api } from './api';
import { getFirebase } from './client';

export function createFirebaseTransport(gameId: string, roomId: string): OnlineTransport {
  const { firestore } = getFirebase();
  return {
    subscribeGame(onGame, onError) {
      return onSnapshot(
        doc(firestore, 'games', gameId),
        { includeMetadataChanges: true },
        (snap) => {
          if (snap.exists()) onGame({ game: snap.data() as GameDoc, fromCache: snap.metadata.fromCache });
        },
        onError,
      );
    },
    subscribePlayers(onPlayers) {
      return onSnapshot(
        collection(firestore, 'rooms', roomId, 'players'),
        (snap) => onPlayers(snap.docs.map((d) => d.data() as RoomPlayerDoc)),
        () => {},
      );
    },
    submitMove: (request) => api.submitMove(request),
    claimInactivity: (targetUid) => api.claimInactivity({ gameId, targetUid }),
    newMoveId: () => crypto.randomUUID().replace(/-/g, ''),
  };
}

export async function loadGame(gameId: string): Promise<GameDoc | null> {
  const snap = await getDoc(doc(getFirebase().firestore, 'games', gameId));
  return snap.exists() ? (snap.data() as GameDoc) : null;
}
