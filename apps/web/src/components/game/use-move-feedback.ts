'use client';

import { useEffect, useRef, useState } from 'react';
import type { GameView } from '@/controllers/types';
import { playSound, vibrate } from '@/lib/feedback';
import { useSettings } from '@/stores/settings-store';

/**
 * Sounds, haptics and a screen-reader announcement for each move (§9.3, §8.4).
 * Returns the text for an aria-live region.
 */
export function useMoveFeedback(view: GameView): string {
  const sound = useSettings((s) => s.sound);
  const vibration = useSettings((s) => s.vibration);
  const [announcement, setAnnouncement] = useState('');
  const lastId = useRef<number | null>(view.lastEvent?.id ?? null);

  const event = view.lastEvent;
  useEffect(() => {
    if (!event || event.id === lastId.current) return;
    lastId.current = event.id;
    const { state } = view;
    const mover = state.players.find((p) => p.id === event.playerId);
    const next = state.players[state.currentPlayerIndex];
    const captured = event.completedCells.length;

    if (sound) playSound(event.gameOver ? 'win' : captured ? 'capture' : 'line');
    if (vibration && captured) vibrate(event.gameOver ? [40, 60, 40, 60, 120] : 35);

    let text = `${mover?.name ?? 'A player'} drew a line.`;
    if (captured) text += ` Captured ${captured} ${captured === 1 ? 'box' : 'boxes'}.`;
    if (event.gameOver) {
      const winners = state.players.filter((p) => state.winnerIds?.includes(p.id));
      text += state.isDraw
        ? ' Game over: draw.'
        : ` Game over: ${winners[0]?.name ?? 'someone'} wins.`;
    } else if (event.extraTurn) {
      text += ' Play again!';
    } else if (next) {
      text += ` ${next.name}'s turn.`;
    }
    const scores = state.players.map((p) => `${p.name} ${p.score}`).join(', ');
    setAnnouncement(`${text} Scores: ${scores}.`);
  }, [event, view, sound, vibration]);

  useEffect(() => {
    if (view.error && sound) playSound('error');
  }, [view.error, sound]);

  return announcement;
}
