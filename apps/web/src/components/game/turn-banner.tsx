'use client';

import { AnimatePresence, motion } from 'motion/react';
import { Loader2, RotateCcw } from 'lucide-react';
import type { GameView } from '@/controllers/types';
import { shapeForIndex } from '@/lib/players';
import { PlayerShapeIcon } from './player-shape';

export function TurnBanner({ view }: { view: GameView }) {
  const { state, lastEvent, thinking } = view;
  const current = state.players[state.currentPlayerIndex];
  if (state.status !== 'playing' || !current) return <div className="h-12" />;
  const mine = view.controllablePlayerIds.includes(current.id);
  const onlyMe = view.controllablePlayerIds.length === 1;
  const label = mine && onlyMe ? 'Your turn' : `${current.name}'s turn`;
  const extra = lastEvent?.extraTurn && lastEvent.playerId === current.id;

  return (
    <div className="flex h-12 items-center justify-center gap-2" aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${current.id}-${state.totalMoves}-${extra ? 'x' : ''}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold text-white shadow"
          style={{ backgroundColor: current.color }}
        >
          <PlayerShapeIcon shape={shapeForIndex(state.currentPlayerIndex)} color="white" size={14} />
          <span className="uppercase tracking-wide">{label}</span>
          {thinking && <Loader2 className="size-4 animate-spin" />}
          {extra && (
            <span className="flex items-center gap-1 rounded-full bg-white/25 px-2 py-0.5 text-xs">
              <RotateCcw className="size-3" /> Play again!
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
