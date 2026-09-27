'use client';

import { CUSTOM_LEVEL, MAX_PLAYERS } from '@dots/game-engine';
import { PLAYER_NAME_MAX, ROOM_CODE_LENGTH, normaliseRoomCode, sanitizePlayerName } from '@dots/protocol';
import { Loader2, LogIn, Plus, RotateCcw, WifiOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { BoardPicker } from '@/components/board-picker';
import type { BoardChoice } from '@/components/board-picker';
import { PageShell, Section } from '@/components/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { OnlineError, api } from '@/firebase/api';
import { ensureSignedIn, isFirebaseConfigured } from '@/firebase/client';
import { navigate } from '@/lib/navigation';
import { useSettings } from '@/stores/settings-store';

function subscribeOnline(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

function showError(error: unknown) {
  toast.error(error instanceof OnlineError ? error.message : 'Something went wrong.');
}

export function OnlineHome() {
  const router = useRouter();
  const online = useOnline();
  const settings = useSettings();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [board, setBoard] = useState<BoardChoice>({ level: 1, rows: 4, columns: 4 });
  const [maxPlayers, setMaxPlayers] = useState(MAX_PLAYERS);
  const [extraTurn, setExtraTurn] = useState(true);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [rejoin, setRejoin] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (settings.hydrated) setName(settings.onlineName || settings.lastPlayerNames[0] || '');
  }, [settings.hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Offer to jump back into an unfinished online game (reconnection, §6.4).
  useEffect(() => {
    if (!online || !isFirebaseConfigured()) return;
    let cancelled = false;
    ensureSignedIn()
      .then(() => api.reconnectPlayer())
      .then((res) => !cancelled && setRejoin(res.roomId))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [online]);

  const cleanName = sanitizePlayerName(name);

  const run = async (kind: 'create' | 'join') => {
    if (!cleanName) {
      toast.error('Enter your name first.');
      return;
    }
    setBusy(kind);
    try {
      await ensureSignedIn();
      settings.set({ onlineName: cleanName });
      const { roomId } =
        kind === 'create'
          ? await api.createRoom({
              name: cleanName,
              board: board.level === CUSTOM_LEVEL ? { level: 0, rows: board.rows, columns: board.columns } : { level: board.level },
              maxPlayers,
              extraTurnOnCapture: extraTurn,
            })
          : await api.joinRoom({ code, name: cleanName });
      navigate(router, `/online/room?id=${roomId}`);
    } catch (error) {
      showError(error);
      setBusy(null);
    }
  };

  if (!online) {
    return (
      <PageShell title="Online Game">
        <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center shadow-sm">
          <WifiOff className="size-10 text-muted-foreground" />
          <p className="font-semibold">Online games need an internet connection.</p>
          <p className="text-sm text-muted-foreground">You can still play against the CPU or with friends on this device.</p>
        </div>
      </PageShell>
    );
  }

  if (!isFirebaseConfigured()) {
    return (
      <PageShell title="Online Game">
        <p className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Online play isn&apos;t configured for this build. Set the <code>NEXT_PUBLIC_FIREBASE_*</code> variables or{' '}
          <code>NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true</code>.
        </p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Online Game">
      {rejoin && (
        <button
          onClick={() => navigate(router, `/online/room?id=${rejoin}`)}
          className="flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/10 p-4 text-left"
        >
          <RotateCcw className="size-5 text-primary" />
          <span className="font-semibold">Rejoin your game</span>
        </button>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="online-name">Your name</Label>
        <Input id="online-name" value={name} maxLength={PLAYER_NAME_MAX} onChange={(e) => setName(e.target.value)} />
      </div>

      <Tabs defaultValue="join" className="gap-4">
        <TabsList className="w-full">
          <TabsTrigger value="join">Join a room</TabsTrigger>
          <TabsTrigger value="create">Create a room</TabsTrigger>
        </TabsList>

        <TabsContent value="join" className="flex flex-col gap-4">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void run('join');
            }}
          >
            <Label htmlFor="room-code">Room code</Label>
            <Input
              id="room-code"
              value={code}
              onChange={(e) => setCode(normaliseRoomCode(e.target.value).slice(0, ROOM_CODE_LENGTH))}
              placeholder="X8K4P2"
              autoCapitalize="characters"
              autoComplete="off"
              className="h-14 text-center font-mono text-2xl tracking-[0.4em] uppercase"
            />
            <Button size="lg" type="submit" disabled={code.length !== ROOM_CODE_LENGTH || busy !== null}>
              {busy === 'join' ? <Loader2 className="animate-spin" /> : <LogIn />} Join
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="create" className="flex flex-col gap-5">
          <Section title="Board">
            <BoardPicker value={board} onChange={setBoard} />
          </Section>
          <Section title="Players">
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(maxPlayers)}
              onValueChange={(v) => v && setMaxPlayers(Number(v))}
              className="w-full"
              aria-label="Maximum players"
            >
              {[2, 3, 4].map((n) => (
                <ToggleGroupItem key={n} value={String(n)} className="flex-1">
                  Up to {n}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Section>
          <div className="flex items-center justify-between rounded-xl bg-card p-3 shadow-sm">
            <Label htmlFor="online-extra">Extra turn on capture</Label>
            <Switch id="online-extra" checked={extraTurn} onCheckedChange={setExtraTurn} />
          </div>
          <Button size="lg" onClick={() => void run('create')} disabled={busy !== null}>
            {busy === 'create' ? <Loader2 className="animate-spin" /> : <Plus />} Create room
          </Button>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
