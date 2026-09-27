'use client';

import type { GameState } from '@dots/game-engine';
import { WifiOff } from 'lucide-react';
import { inkOn, shapeForIndex, surfaceEdge, surfaceShade } from '@/lib/players';
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
    <ol className="flex gap-2 pt-2">
      {state.players.map((player, index) => {
        const active = state.status === 'playing' && index === state.currentPlayerIndex;
        const offline = disconnectedPlayerIds.includes(player.id);
        const fg = active ? inkOn(player.color) : '#2B1B4A';
        return (
          <li
            key={player.id}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-[20px] px-1.5 pt-2.5 pb-2 transition-all duration-300 ease-[cubic-bezier(.3,1.6,.5,1)]',
              !player.active && 'opacity-40',
            )}
            style={{
              background: active ? surfaceShade(player.color) : '#FFFFFF',
              boxShadow: active ? `0 6px 0 ${surfaceEdge(player.color)}, 0 14px 22px -8px ${player.color}` : '0 4px 0 #EFE3CE',
              transform: active ? 'translateY(-4px) scale(1.05)' : 'none',
            }}
          >
            <span
              aria-hidden="true"
              className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-ink px-2 py-[3px] text-[9px] font-black tracking-[1px] whitespace-nowrap text-white transition-opacity duration-200"
              style={{ opacity: active ? 1 : 0 }}
            >
              TURN
            </span>
            <div className="flex max-w-full items-center gap-[5px]">
              <span
                aria-hidden="true"
                className="flex size-[18px] flex-none items-center justify-center rounded-full"
                style={{ background: active ? '#FFFFFF' : player.color }}
              >
                <PlayerShapeIcon shape={shapeForIndex(index)} color={active ? player.color : inkOn(player.color)} size={9} />
              </span>
              <span className="truncate text-xs font-extrabold" style={{ color: fg }}>
                {player.name}
                {localPlayerIds.length === 1 && localPlayerIds[0] === player.id ? ' (you)' : ''}
              </span>
              {offline && <WifiOff className="size-3.5 flex-none text-pink-d" aria-label="disconnected" />}
            </div>
            <span
              key={player.score}
              className={cn(
                'inline-block font-display text-[32px] leading-none font-extrabold tabular-nums',
                player.score > 0 && 'animate-[bh-pop_.5s_cubic-bezier(.3,1.6,.5,1)]',
              )}
              style={{ color: fg }}
            >
              {player.score}
            </span>
            {active && <span className="sr-only">Current turn</span>}
            {!player.active && <span className="text-[10px] font-black text-label uppercase">left</span>}
          </li>
        );
      })}
    </ol>
  );
}
