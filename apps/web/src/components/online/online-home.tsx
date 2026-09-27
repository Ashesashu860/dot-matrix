'use client';

import { CUSTOM_LEVEL, MAX_PLAYERS } from '@dots/game-engine';
import { ONLINE_MAX_DOTS, PLAYER_NAME_MAX, ROOM_CODE_LENGTH, normaliseRoomCode, sanitizePlayerName } from '@dots/protocol';
import { Loader2, WifiOff } from 'lucide-react';
import { Tabs as TabsPrimitive } from 'radix-ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { BoardPicker } from '@/components/board-picker';
import type { BoardChoice } from '@/components/board-picker';
import { Chunky } from '@/components/kit';
import { PageShell, Section } from '@/components/page-shell';
import { Switch } from '@/components/ui/switch';
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
      <PageShell title="Online">
        <Section title="No connection">
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <WifiOff className="size-10 text-label" />
            <p className="text-[17px] font-extrabold text-ink">Online games need an internet connection.</p>
            <p className="text-sm font-bold text-label">You can still play against the CPU or with friends on this device.</p>
          </div>
        </Section>
      </PageShell>
    );
  }

  if (!isFirebaseConfigured()) {
    return (
      <PageShell title="Online">
        <Section title="Not configured">
          <p className="text-sm font-bold text-label">
            Online play isn&apos;t configured for this build. Set the <code>NEXT_PUBLIC_FIREBASE_*</code> variables or{' '}
            <code>NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true</code>.
          </p>
        </Section>
      </PageShell>
    );
  }

  return (
    <PageShell title="Online" right={<OnlinePill />}>
      {rejoin && (
        <Chunky tone="dark" onClick={() => navigate(router, `/online/room?id=${rejoin}`)} className="flex h-16 items-center gap-3 rounded-[22px] px-4 text-left text-xl">
          <span className="flex size-9 items-center justify-center rounded-full bg-white pl-0.5 text-base text-ink">▶</span>
          Rejoin your game
        </Chunky>
      )}

      <section className="card-3d flex flex-col gap-2 p-4">
        <label htmlFor="online-name" className="card-label">
          Your name
        </label>
        <input
          id="online-name"
          value={name}
          maxLength={PLAYER_NAME_MAX}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </section>

      <TabsPrimitive.Root defaultValue="join" className="flex flex-col gap-3.5">
        <TabsPrimitive.List className="flex gap-1.5 rounded-2xl bg-white p-1 shadow-[0_4px_0_#EFE3CE]">
          {[
            ['join', 'Join a room'],
            ['create', 'Create a room'],
          ].map(([value, label]) => (
            <TabsPrimitive.Trigger
              key={value}
              value={value!}
              className="h-11 flex-1 cursor-pointer rounded-xl font-display text-lg font-extrabold text-ink transition-all duration-150 data-[state=active]:bg-ink data-[state=active]:text-white"
            >
              {label}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        <TabsPrimitive.Content value="join" className="outline-none">
          <form
            className="card-3d flex flex-col items-center gap-3 px-4 py-[18px]"
            onSubmit={(e) => {
              e.preventDefault();
              void run('join');
            }}
          >
            <label htmlFor="room-code" className="card-label">
              Room code
            </label>
            <input
              id="room-code"
              value={code}
              onChange={(e) => setCode(normaliseRoomCode(e.target.value).slice(0, ROOM_CODE_LENGTH))}
              placeholder="X8K4P2"
              autoCapitalize="characters"
              autoComplete="off"
              className="h-[60px] w-full rounded-[14px] border-none bg-soft text-center font-display text-[32px] font-extrabold tracking-[0.35em] text-ink uppercase shadow-[inset_0_-4px_0_#E6DCF0] outline-none placeholder:text-[#CFC3E0] focus:shadow-[0_0_0_3px_#7B5CFF]"
            />
            <Chunky
              type="submit"
              tone="pink"
              lift={6}
              disabled={code.length !== ROOM_CODE_LENGTH || busy !== null}
              className="flex h-[60px] w-full items-center justify-center gap-2 rounded-[22px] text-2xl"
            >
              {busy === 'join' && <Loader2 className="size-5 animate-spin" />} Join
            </Chunky>
          </form>
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="create" className="flex flex-col gap-3.5 outline-none">
          <Section title="Level">
            <BoardPicker value={board} onChange={setBoard} maxDots={ONLINE_MAX_DOTS} />
          </Section>
          <Section title="Players">
            <div className="flex gap-2" role="radiogroup" aria-label="Maximum players">
              {[2, 3, 4].map((n) => {
                const selected = maxPlayers === n;
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setMaxPlayers(n)}
                    className="h-12 flex-1 cursor-pointer rounded-2xl font-display text-base font-extrabold transition-all duration-150"
                    style={{ background: selected ? '#2B1B4A' : '#F6F1FB', color: selected ? '#fff' : '#2B1B4A' }}
                  >
                    Up to {n}
                  </button>
                );
              })}
            </div>
          </Section>
          <section className="card-3d flex items-center gap-3 px-4 py-3.5">
            <label htmlFor="online-extra" className="flex flex-1 flex-col gap-px">
              <span className="text-[17px] font-extrabold text-ink">Extra turn on capture</span>
              <span className="text-[13px] font-bold text-label">Closing a box lets you go again</span>
            </label>
            <Switch id="online-extra" checked={extraTurn} onCheckedChange={setExtraTurn} />
          </section>
          <Chunky
            tone="pink"
            lift={7}
            glow
            onClick={() => void run('create')}
            disabled={busy !== null}
            className="flex h-[72px] w-full items-center justify-center gap-2 rounded-3xl text-[26px]"
          >
            {busy === 'create' && <Loader2 className="size-6 animate-spin" />} Create room
          </Chunky>
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </PageShell>
  );
}

const inputClass =
  'w-full rounded-xl border-none bg-soft px-3 py-[11px] text-base font-extrabold text-ink outline-none focus:shadow-[0_0_0_3px_#7B5CFF]';

export function OnlinePill() {
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 shadow-[0_3px_0_#EADFCB]">
      <span className="size-2 rounded-full bg-green" />
      <span className="text-[11px] font-black text-ink">ONLINE</span>
    </span>
  );
}
