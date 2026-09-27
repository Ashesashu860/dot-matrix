'use client';

import type { GameState } from '@dots/game-engine';
import { AnimatePresence, motion } from 'motion/react';
import { WifiOff } from 'lucide-react';
import { shapeForIndex } from '@/lib/players';
import { cn } from '@/lib/utils';
import { PlayerShapeIcon } from './player-shape';

export function Scoreboard({
  state,
  disconnectedPlayerIds = [],
  localPlayerIds = [],
}: {
  state: GameState;
  disconnectedPlayerIds?: string[];
  localPlayerIds?: string[];
}) {
  return (
    <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${state.players.length}, minmax(0, 1fr))` }}>
      {state.players.map((player, index) => {
        const active = state.status === 'playing' && index === state.currentPlayerIndex;
        const offline = disconnectedPlayerIds.includes(player.id);
        return (
          <li
            key={player.id}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'relative flex min-w-0 flex-col items-center gap-0.5 rounded-2xl border-2 bg-card px-2 py-2 shadow-sm transition-all',
              active ? 'scale-[1.03] shadow-md' : 'border-transparent opacity-80',
              !player.active && 'opacity-40',
            )}
            style={active ? { borderColor: player.color } : undefined}
          >
            <div className="flex max-w-full items-center gap-1.5">
              <PlayerShapeIcon shape={shapeForIndex(index)} color={player.color} size={14} />
              <span className="truncate text-xs font-medium sm:text-sm">
                {player.name}
                {localPlayerIds.length === 1 && localPlayerIds[0] === player.id ? ' (you)' : ''}
              </span>
              {offline && <WifiOff className="size-3.5 text-destructive" aria-label="disconnected" />}
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={player.score}
                initial={{ y: -12, opacity: 0, scale: 1.4 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 12, opacity: 0 }}
                className="text-2xl font-bold tabular-nums"
                style={{ color: player.color }}
              >
                {player.score}
              </motion.span>
            </AnimatePresence>
            {active && <span className="sr-only">Current turn</span>}
            {!player.active && <span className="text-[10px] uppercase text-muted-foreground">left</span>}
          </li>
        );
      })}
    </ol>
  );
}
