'use client';

import { getLevel } from '@dots/game-engine';
import type { RoomDoc, RoomPlayerDoc } from '@dots/protocol';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { CardLabel, Chunky, Pill, PlayerToken } from '@/components/kit';
import { PageShell } from '@/components/page-shell';
import { OnlineError, api } from '@/firebase/api';
import { shapeForIndex } from '@/lib/players';
import { OnlinePill } from './online-home';

export function Lobby({
  roomId,
  room,
  players,
  uid,
  onLeave,
}: {
  roomId: string;
  room: RoomDoc;
  players: RoomPlayerDoc[];
  uid: string;
  onLeave(): void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const isHost = room.hostUid === uid;
  const me = players.find((p) => p.uid === uid);
  const ordered = [...players].sort((a, b) => a.joinedAt - b.joinedAt);
  const everyoneReady = ordered.every((p) => p.uid === room.hostUid || p.ready);
  const canStart = isHost && ordered.length >= 2 && everyoneReady;
  const board = getLevel(room.level) ? `Level ${room.level} · ${room.rows}×${room.columns}` : `Custom · ${room.rows}×${room.columns}`;
  const hint =
    ordered.length < 2
      ? 'Waiting for friends to join'
      : !everyoneReady
        ? 'Everyone must be ready'
        : isHost
          ? `${ordered.length} players ready`
          : 'Waiting for the host to start';

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } catch (error) {
      toast.error(error instanceof OnlineError ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopied(true);
  };

  const share = async () => {
    const text = `Join my Dotsnatch game with code ${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Dotsnatch', text });
      else await copy();
    } catch {
      // cancelled
    }
  };

  return (
    <PageShell
      title="Private room"
      onBack={onLeave}
      right={<OnlinePill />}
      footer={
        <div className="flex gap-2.5">
          {!isHost && (
            <Chunky
              tone={me?.ready ? 'green' : 'white'}
              lift={6}
              aria-pressed={!!me?.ready}
              disabled={busy}
              onClick={() => act(() => api.setPlayerReady({ roomId, ready: !me?.ready }))}
              className="h-[72px] w-[120px] flex-none rounded-3xl text-xl"
            >
              {me?.ready ? 'Ready ✓' : 'Ready?'}
            </Chunky>
          )}
          <Chunky
            tone={canStart ? 'pink' : 'off'}
            lift={6}
            aria-disabled={!canStart || busy}
            onClick={() => (canStart && !busy ? act(() => api.startGame({ roomId })) : undefined)}
            className="flex h-[72px] flex-1 flex-col items-center justify-center gap-0.5 rounded-3xl"
          >
            <span className="flex items-center gap-2 text-2xl leading-none">
              {busy && isHost && <Loader2 className="size-5 animate-spin" />}
              Start match
            </span>
            <span className="font-sans text-xs font-extrabold">{hint}</span>
          </Chunky>
        </div>
      }
    >
      <section className="card-3d flex flex-col items-center gap-3 px-4 py-[18px]">
        <CardLabel>Room code</CardLabel>
        <div className="flex gap-1.5" role="img" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code.split('').map((ch, i) => (
            <span
              key={i}
              className="flex h-[54px] w-11 items-center justify-center rounded-[14px] bg-soft font-display text-[30px] leading-none font-extrabold text-ink shadow-[inset_0_-4px_0_#E6DCF0]"
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={copy} className="cursor-pointer rounded-full bg-ink px-[18px] py-[9px] text-sm font-extrabold text-white active:scale-95">
            {copied ? 'Copied!' : 'Copy invite code'}
          </button>
          <button onClick={share} className="cursor-pointer rounded-full bg-soft px-[18px] py-[9px] text-sm font-extrabold text-ink active:scale-95">
            Share
          </button>
        </div>
      </section>

      <section className="card-3d flex flex-col gap-2.5 p-4">
        <CardLabel>
          Players · {ordered.length}/{room.maxPlayers}
        </CardLabel>
        <ul className="flex flex-col gap-2.5" aria-live="polite">
          {ordered.map((p, i) => {
            const host = p.uid === room.hostUid;
            const you = p.uid === uid;
            const role = host ? (you ? 'Host · you' : 'Host') : you ? 'You' : 'Joined';
            return (
              <li key={p.uid} className="flex items-center gap-3 animate-[bh-turn_.35s_ease-out]">
                <PlayerToken color={p.color} shape={shapeForIndex(i)} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[17px] font-extrabold text-ink">{p.name}</span>
                  <span className="text-[11px] font-extrabold text-label">{role}</span>
                </div>
                {!p.connected && <Pill style={{ background: '#FFE0EA', color: '#B8174F' }}>OFFLINE</Pill>}
                {host ? (
                  <Pill style={{ background: '#FFF1D6', color: '#9A5E00' }}>HOST</Pill>
                ) : (
                  <Pill style={p.ready ? { background: '#D2F5E1', color: '#0F7A40' } : undefined}>
                    {p.ready ? 'READY' : 'NOT READY'}
                  </Pill>
                )}
              </li>
            );
          })}
          {Array.from({ length: Math.max(0, room.maxPlayers - ordered.length) }, (_, i) => (
            <li key={`empty-${i}`} className="flex items-center gap-3 opacity-60">
              <span className="size-9 flex-none rounded-full border-[2.5px] border-dashed border-[#CFC3E0]" />
              <span className="text-[15px] font-extrabold text-label">Waiting for player…</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-3d flex flex-col px-4 py-3.5">
        <CardLabel>Board</CardLabel>
        <span className="font-display text-lg font-extrabold text-ink">{board}</span>
        <span className="text-xs font-bold text-label">
          {room.extraTurnOnCapture ? 'Extra turn on capture' : 'No extra turn on capture'}
        </span>
      </section>
    </PageShell>
  );
}
