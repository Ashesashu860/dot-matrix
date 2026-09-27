'use client';

import type { GameView } from '@/controllers/types';
import { inkOn, shapeForIndex, surfaceEdge, surfaceShade } from '@/lib/players';
import { PlayerShapeIcon } from './player-shape';

/** Whose turn it is, as a pill in the current player's colour. */
export function TurnBanner({ view }: { view: GameView }) {
  const { state } = view;
  const current = state.players[state.currentPlayerIndex];
  if (!current) return <div className="h-[50px]" />;
  const finished = state.status !== 'playing';
  const mine = view.controllablePlayerIds.includes(current.id);
  const onlyMe = view.controllablePlayerIds.length === 1;
  const label = finished
    ? 'Board complete!'
    : current.type === 'cpu'
      ? `${current.name} is thinking…`
      : mine && onlyMe
        ? 'Your turn — draw a line'
        : mine
          ? `${current.name}'s turn`
          : `${current.name} is playing…`;

  return (
    <div className="flex justify-center" aria-hidden="true">
      <div
        key={`${current.id}-${state.status}`}
        className="flex items-center gap-2.5 rounded-full py-2.5 pr-[22px] pl-2.5 font-display text-[19px] leading-none font-extrabold animate-[bh-turn_.35s_cubic-bezier(.3,1.6,.5,1)]"
        style={{ background: surfaceShade(current.color), color: inkOn(current.color), boxShadow: `0 5px 0 ${surfaceEdge(current.color)}` }}
      >
        <span className="flex size-[30px] items-center justify-center rounded-full bg-white">
          <PlayerShapeIcon shape={shapeForIndex(state.currentPlayerIndex)} color={current.color} size={13} />
        </span>
        {label}
      </div>
    </div>
  );
}
