'use client';

import type { RoomDoc, RoomPlayerDoc } from '@dots/protocol';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { GameScreen } from '@/components/game/game-screen';
import { PageShell } from '@/components/page-shell';
import { Chunky } from '@/components/kit';
import { OnlineController } from '@/controllers/online-controller';
import { api } from '@/firebase/api';
import { ensureSignedIn, getFirebase } from '@/firebase/client';
import { trackPresence } from '@/firebase/presence';
import { createFirebaseTransport, loadGame } from '@/firebase/transport';
import { navigate } from '@/lib/navigation';
import { useProgress } from '@/stores/progress-store';
import { Lobby } from './lobby';

type Phase = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready' };

export function RoomScreen() {
  const router = useRouter();
  const roomId = useSearchParams().get('id');
  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [players, setPlayers] = useState<RoomPlayerDoc[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [controller, setController] = useState<OnlineController | null>(null);
  const rtdbConnected = useRef(true);

  useEffect(() => {
    ensureSignedIn()
      .then((user) => setUid(user.uid))
      .catch(() => setPhase({ kind: 'error', message: 'Could not sign in. Check your connection.' }));
  }, []);

  // Live room + player list.
  useEffect(() => {
    if (!uid || !roomId) return;
    const { firestore } = getFirebase();
    const unsubRoom = onSnapshot(
      doc(firestore, 'rooms', roomId),
      (snap) => {
        if (!snap.exists()) return setPhase({ kind: 'error', message: 'This room no longer exists.' });
        setRoom(snap.data() as RoomDoc);
        setPhase({ kind: 'ready' });
      },
      // Security rules deny reads to non-members.
      () => setPhase({ kind: 'error', message: "You're not in this room." }),
    );
    const unsubPlayers = onSnapshot(
      collection(firestore, 'rooms', roomId, 'players'),
      (snap) => setPlayers(snap.docs.map((d) => d.data() as RoomPlayerDoc)),
      () => {},
    );
    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [uid, roomId]);

  // Presence while this screen is open.
  useEffect(() => {
    if (!uid || !roomId || phase.kind !== 'ready') return;
    return trackPresence(roomId, uid, (connected) => {
      rtdbConnected.current = connected;
      controllerRef.current?.setRealtimeConnected(connected);
    });
  }, [uid, roomId, phase.kind]);

  // Create the online controller once the game exists; resubscribes on reload/reconnect.
  const controllerRef = useRef<OnlineController | null>(null);
  const gameId = room?.activeGameId ?? null;
  useEffect(() => {
    if (!uid || !roomId || !gameId) return;
    let cancelled = false;
    let created: OnlineController | null = null;
    void loadGame(gameId).then((game) => {
      if (cancelled || !game) return;
      created = new OnlineController(game, uid, createFirebaseTransport(gameId, roomId));
      created.setRealtimeConnected(rtdbConnected.current);
      controllerRef.current = created;
      setController(created);
    });
    return () => {
      cancelled = true;
      created?.dispose();
      controllerRef.current = null;
      setController(null);
    };
  }, [uid, roomId, gameId]);

  if (!roomId) return <RoomMessage message="No room selected." />;
  if (phase.kind === 'error') return <RoomMessage message={phase.message} />;
  if (phase.kind === 'loading' || !room || !uid) return <Spinner />;
  if (room.status === 'cancelled') return <RoomMessage message="The host closed this room." />;

  const leave = async () => {
    const playing = controller?.getView().state.status === 'playing';
    if (room.status === 'waiting' || playing) await api.leaveRoom({ roomId }).catch(() => {});
    navigate(router, '/');
  };

  if (controller) return <OnlineGame controller={controller} uid={uid} onExit={leave} />;
  if (room.status === 'waiting') {
    return <Lobby roomId={roomId} room={room} players={players} uid={uid} onLeave={leave} />;
  }
  return <Spinner />;
}

function OnlineGame({ controller, uid, onExit }: { controller: OnlineController; uid: string; onExit(): void }) {
  const router = useRouter();
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const recorded = useRef<string | null>(null);

  // Keep a local history/stats entry too; the authoritative stats live server-side.
  useEffect(() => {
    if (view.state.status !== 'finished' || recorded.current === view.state.gameId) return;
    recorded.current = view.state.gameId;
    void useProgress.getState().recordGame(view.state, uid);
  }, [view.state, uid]);

  return (
    <GameScreen
      controller={controller}
      perspectiveId={uid}
      onExit={onExit}
      onNewGame={() => navigate(router, '/online')}
      online
    />
  );
}

function Spinner() {
  return (
    <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
      <Loader2 className="size-8 animate-spin text-screen-soft" />
    </div>
  );
}

function RoomMessage({ message }: { message: string }) {
  return (
    <PageShell title="Online" backHref="/online">
      <section className="card-3d flex flex-col items-center gap-4 p-6 text-center">
        <p className="text-[17px] font-extrabold text-ink">{message}</p>
        <Chunky asChild tone="pink" className="flex h-12 items-center rounded-[18px] px-6 text-lg">
          <Link href="/online">Back</Link>
        </Chunky>
      </section>
    </PageShell>
  );
}
