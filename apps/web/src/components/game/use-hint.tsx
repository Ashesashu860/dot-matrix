'use client';

import type { GameState } from '@dots/game-engine';
import { Lightbulb } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Chunky } from '@/components/kit';
import type { BotOptions } from '@/workers/cpu-protocol';
import { sharedRunner } from '@/workers/cpu-runner';

/**
 * Ask the Hard bot for the best line for the human to move. The hint stays on
 * the board until the next move.
 */
export function useHint(state: GameState, humanId: string, options?: BotOptions) {
  const [hint, setHint] = useState<{ edgeId: string; move: number; gameId: string } | null>(null);
  const myTurn = state.status === 'playing' && state.players[state.currentPlayerIndex]?.id === humanId;

  const ask = async () => {
    if (!myTurn) return false;
    const { totalMoves: move, gameId } = state;
    try {
      const edgeId = await sharedRunner().choose(state, 'hard', move, options);
      setHint({ edgeId, move, gameId });
      return true;
    } catch {
      toast.error('No hint available');
      return false;
    }
  };

  const current = hint && hint.move === state.totalMoves && hint.gameId === state.gameId;
  return { myTurn, hintEdgeId: current ? hint.edgeId : null, ask };
}

export function HintButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <Chunky tone="soft" onClick={onClick} className="flex h-12 items-center justify-center gap-2 rounded-[18px] text-lg">
      <Lightbulb className="size-5" aria-hidden="true" />
      {label}
    </Chunky>
  );
}
