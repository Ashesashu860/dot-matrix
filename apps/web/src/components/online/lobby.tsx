'use client';

import { getLevel } from '@dots/game-engine';
import type { RoomDoc, RoomPlayerDoc } from '@dots/protocol';
import { Check, Copy, Crown, Loader2, LogOut, Play, Share2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PlayerShapeIcon } from '@/components/game/player-shape';
import { PageShell, Section } from '@/components/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OnlineError, api } from '@/firebase/api';
import { shapeForIndex } from '@/lib/players';

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
  const isHost = room.hostUid === uid;
  const me = players.find((p) => p.uid === uid);
  const ordered = [...players].sort((a, b) => a.joinedAt - b.joinedAt);
  const everyoneReady = ordered.every((p) => p.uid === room.hostUid || p.ready);
  const canStart = isHost && ordered.length >= 2 && everyoneReady;
  const board = getLevel(room.level) ? `Level ${room.level} · ${room.rows}×${room.columns}` : `${room.rows}×${room.columns} custom`;

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

  const share = async () => {
    const text = `Join my Box Hunt game with code ${room.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Box Hunt', text });
      else {
        await navigator.clipboard.writeText(room.code);
        toast.success('Code copied');
      }
    } catch {
      // cancelled
    }
  };

  return (
    <PageShell
      title="Lobby"
      backHref="/online"
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" onClick={onLeave} disabled={busy}>
            <LogOut /> Leave
          </Button>
          {isHost ? (
            <Button size="lg" className="flex-1" disabled={!canStart || busy} onClick={() => act(() => api.startGame({ roomId }))}>
              {busy ? <Loader2 className="animate-spin" /> : <Play />} Start game
            </Button>
          ) : (
            <Button
              size="lg"
              className="flex-1"
              variant={me?.ready ? 'outline' : 'default'}
              disabled={busy}
              onClick={() => act(() => api.setPlayerReady({ roomId, ready: !me?.ready }))}
            >
              {me?.ready ? 'Not ready' : (<><Check /> I&apos;m ready</>)}
            </Button>
          )}
        </div>
      }
    >
      <section className="flex flex-col items-center gap-2 rounded-3xl bg-card p-5 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">Room code</p>
        <p className="font-mono text-4xl font-bold tracking-[0.3em]" aria-label={`Room code ${room.code.split('').join(' ')}`}>
          {room.code}
        </p>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard?.writeText(room.code).catch(() => {});
              toast.success('Code copied');
            }}
          >
            <Copy /> Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={share}>
            <Share2 /> Share
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {board} · up to {room.maxPlayers} players
        </p>
      </section>

      <Section title={`Players (${ordered.length}/${room.maxPlayers})`}>
        <ul className="flex flex-col gap-2" aria-live="polite">
          {ordered.map((p, i) => (
            <li key={p.uid} className="flex items-center gap-3 rounded-xl bg-card p-3 shadow-sm">
              <PlayerShapeIcon shape={shapeForIndex(i)} color={p.color} size={20} />
              <span className="flex-1 truncate font-medium">
                {p.name}
                {p.uid === uid && <span className="text-muted-foreground"> (you)</span>}
              </span>
              {!p.connected && <Badge variant="outline">offline</Badge>}
              {p.uid === room.hostUid ? (
                <Badge variant="secondary">
                  <Crown className="size-3" /> Host
                </Badge>
              ) : p.ready ? (
                <Badge className="bg-emerald-600 text-white">
                  <Check className="size-3" /> Ready
                </Badge>
              ) : (
                <Badge variant="outline">Not ready</Badge>
              )}
            </li>
          ))}
        </ul>
        {isHost && !canStart && (
          <p className="text-center text-sm text-muted-foreground">
            {ordered.length < 2 ? 'Share the code — waiting for players to join…' : 'Waiting for everyone to be ready…'}
          </p>
        )}
        {!isHost && <p className="text-center text-sm text-muted-foreground">Waiting for the host to start…</p>}
      </Section>
    </PageShell>
  );
}
