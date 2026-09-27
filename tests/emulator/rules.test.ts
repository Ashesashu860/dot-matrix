import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { get, ref, set } from 'firebase/database';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const root = path.join(import.meta.dirname, '..', '..', 'firebase');
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    // Separate project so clearing data never affects the functions tests.
    projectId: 'demo-dots-rules',
    firestore: { rules: readFileSync(path.join(root, 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
    database: { rules: readFileSync(path.join(root, 'database.rules.json'), 'utf8'), host: '127.0.0.1', port: 9000 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'rooms/r1'), { hostUid: 'alice', playerUids: ['alice', 'bob'], status: 'playing' });
    await setDoc(doc(db, 'rooms/r1/players/alice'), { name: 'Alice', ready: true });
    await setDoc(doc(db, 'games/g1'), {
      memberUids: ['alice', 'bob'],
      seq: 0,
      state: { players: [{ id: 'alice', score: 0 }, { id: 'bob', score: 0 }], currentPlayerIndex: 0 },
    });
    await setDoc(doc(db, 'games/g1/moves/00000'), { edgeId: 'H-0-0', playerUid: 'alice' });
    await setDoc(doc(db, 'playerStats/alice'), { gamesPlayed: 1 });
    await setDoc(doc(db, 'roomCodes/ABCDEF'), { roomId: 'r1' });
    await ctx.database().ref('rooms/r1/members').set({ alice: true, bob: true });
  });
});

const alice = () => env.authenticatedContext('alice');
const mallory = () => env.authenticatedContext('mallory');

describe('firestore: authoritative fields are server-only', () => {
  it('members can read their room, game and moves', async () => {
    const db = alice().firestore();
    await assertSucceeds(getDoc(doc(db, 'rooms/r1')));
    await assertSucceeds(getDoc(doc(db, 'rooms/r1/players/alice')));
    await assertSucceeds(getDoc(doc(db, 'games/g1')));
    await assertSucceeds(getDoc(doc(db, 'games/g1/moves/00000')));
  });

  it('non-members and signed-out users cannot read games or rooms', async () => {
    for (const db of [mallory().firestore(), env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(db, 'rooms/r1')));
      await assertFails(getDoc(doc(db, 'games/g1')));
      await assertFails(getDoc(doc(db, 'games/g1/moves/00000')));
    }
  });

  it('even members cannot write scores, turns, ownership, moves or status', async () => {
    const db = alice().firestore();
    await assertFails(updateDoc(doc(db, 'games/g1'), { 'state.players': [{ id: 'alice', score: 99 }] }));
    await assertFails(updateDoc(doc(db, 'games/g1'), { 'state.currentPlayerIndex': 1 }));
    await assertFails(updateDoc(doc(db, 'games/g1'), { 'state.status': 'finished', 'state.winnerIds': ['alice'] }));
    await assertFails(updateDoc(doc(db, 'games/g1'), { seq: 5 }));
    await assertFails(setDoc(doc(db, 'games/g1/moves/00001'), { edgeId: 'H-0-1', playerUid: 'alice' }));
    await assertFails(deleteDoc(doc(db, 'games/g1/moves/00000')));
    await assertFails(setDoc(doc(db, 'games/g2'), { memberUids: ['alice'] }));
    await assertFails(updateDoc(doc(db, 'rooms/r1'), { status: 'finished' }));
    await assertFails(updateDoc(doc(db, 'rooms/r1/players/alice'), { ready: false }));
    await assertFails(setDoc(doc(db, 'playerStats/alice'), { gamesPlayed: 100 }));
  });

  it('server-only collections are closed', async () => {
    const db = alice().firestore();
    await assertFails(getDoc(doc(db, 'roomCodes/ABCDEF')));
    await assertFails(setDoc(doc(db, 'rateLimits/alice_createRoom'), { tokens: 100 }));
  });

  it('players read only their own stats', async () => {
    await assertSucceeds(getDoc(doc(alice().firestore(), 'playerStats/alice')));
    await assertFails(getDoc(doc(mallory().firestore(), 'playerStats/alice')));
  });

  it('users may write only a valid profile for themselves', async () => {
    const db = alice().firestore();
    await assertSucceeds(setDoc(doc(db, 'users/alice'), { displayName: 'Alice', createdAt: 1 }));
    await assertFails(setDoc(doc(db, 'users/alice'), { displayName: 'x'.repeat(21), createdAt: 1 }));
    await assertFails(setDoc(doc(db, 'users/alice'), { displayName: 'Alice', createdAt: 1, admin: true }));
    await assertFails(setDoc(doc(db, 'users/bob'), { displayName: 'Bob', createdAt: 1 }));
  });
});

describe('realtime database presence rules', () => {
  it('members write only their own presence with a valid shape', async () => {
    const db = alice().database();
    await assertSucceeds(set(ref(db, 'status/r1/alice'), { state: 'online', at: 1 }));
    await assertFails(set(ref(db, 'status/r1/bob'), { state: 'offline', at: 1 }));
    await assertFails(set(ref(db, 'status/r1/alice'), { state: 'hacked', at: 1 }));
    await assertFails(set(ref(db, 'status/r1/alice'), { state: 'online', at: 1, score: 9 }));
    await assertSucceeds(get(ref(db, 'status/r1')));
  });

  it('non-members can neither read nor write room presence', async () => {
    const db = mallory().database();
    await assertFails(set(ref(db, 'status/r1/mallory'), { state: 'online', at: 1 }));
    await assertFails(get(ref(db, 'status/r1')));
    await assertFails(set(ref(db, 'rooms/r1/members/mallory'), true));
  });
});
