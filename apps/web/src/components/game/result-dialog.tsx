'use client';

import { computeResultSummary, getLevel } from '@dots/game-engine';
import type { GameState } from '@dots/game-engine';
import { PLAYER_COLORS } from '@dots/protocol';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Chunky } from '@/components/kit';
import { darkShade, formatClock, inkOn, shapeForIndex } from '@/lib/players';
import { PlayerShapeIcon } from './player-shape';

function Confetti() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 46 }, (_, i) => (
        <div
          key={i}
          className="absolute -top-[30px]"
          style={{
            left: `${((i * 37 + (i % 3) * 11) % 380) / 3.8}%`,
            width: 8 + (i % 3) * 2,
            height: 12 + (i % 4) * 2,
            borderRadius: i % 3 === 0 ? '50%' : 3,
            background: i % 5 === 4 ? '#FFD84D' : PLAYER_COLORS[i % 4],
            animation: `bh-fall ${2.6 + (i % 5) * 0.5}s linear ${(i * 0.13) % 2.6}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Rays({ color }: { color: string }) {
  const mask = 'radial-gradient(circle, #000 25%, transparent 68%)';
  return (
    <div
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 -mt-[190px] -ml-[190px] size-[380px] rounded-full opacity-[.28] animate-[bh-spin_16s_linear_infinite]"
      style={{
        background: `repeating-conic-gradient(${color} 0 9deg, transparent 9deg 24deg)`,
        WebkitMaskImage: mask,
        maskImage: mask,
      }}
    />
  );
}

export function ResultDialog({
  state,
  open,
  onOpenChange,
  perspectiveId,
  modeLabel,
  onRematch,
  onNextLevel,
  onNewGame,
  onHome,
}: {
  state: GameState;
  open: boolean;
  onOpenChange(open: boolean): void;
  perspectiveId: string | null;
  /** Short mode name for the stats row, e.g. "Hard" or "Local". */
  modeLabel: string;
  onRematch?: () => void;
  onNextLevel?: () => void;
  onNewGame?: () => void;
  onHome(): void;
}) {
  if (state.status !== 'finished') return null;
  const summary = computeResultSummary(state);
  const total = state.rows > 1 && state.columns > 1 ? (state.rows - 1) * (state.columns - 1) : 1;
  const winnerIndex = state.players.findIndex((p) => summary.winnerIds.includes(p.id));
  const winner = state.players[winnerIndex];
  const iWon = perspectiveId !== null && !summary.isDraw && summary.winnerIds.includes(perspectiveId);
  const topScore = Math.max(...summary.players.map((p) => p.score));

  const headline = summary.isDraw ? "It's a draw!" : iWon ? 'You win!' : `${winner?.name ?? 'Someone'} wins!`;
  const sub = summary.isDraw
    ? 'Evenly matched — go again?'
    : iWon && state.mode === 'cpu' && getLevel(state.level)
      ? onNextLevel
        ? `Level ${state.level + 1} unlocked!`
        : `Level ${state.level} cleared`
      : perspectiveId === null || iWon
        ? `${topScore} of ${total} boxes captured`
        : 'So close — rematch?';

  const color = summary.isDraw || !winner ? '#2B1B4A' : winner.color;
  const edge = summary.isDraw || !winner ? '#000000' : darkShade(winner.color);
  const ranked = state.players.map((p, i) => ({ p, i })).sort((a, b) => b.p.score - a.p.score);

  const primary = onNextLevel
    ? { label: 'Next level →', run: onNextLevel }
    : onRematch
      ? { label: 'Rematch', run: onRematch }
      : onNewGame
        ? { label: 'New game', run: onNewGame }
        : null;
  const secondary = onNextLevel && onRematch
    ? { label: 'Rematch', run: onRematch }
    : primary?.run !== onNewGame && onNewGame
      ? { label: 'New game', run: onNewGame }
      : null;

  const stats: Array<[string, string | number]> = [
    ['Moves', summary.totalMoves],
    ['Time', formatClock(summary.durationMs ?? 0)],
    ['Board', `${state.rows}×${state.columns}`],
    ['Mode', modeLabel],
  ];

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 overflow-y-auto outline-none"
          style={{
            backgroundColor: 'var(--app-bg)',
            backgroundImage: 'radial-gradient(var(--app-dots) 1.4px, transparent 1.4px)',
            backgroundSize: '18px 18px',
          }}
        >
          {!(perspectiveId !== null && !iWon && !summary.isDraw) && <Confetti />}
          <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col items-center gap-3 px-5 pt-[max(env(safe-area-inset-top),14px)] pb-[max(env(safe-area-inset-bottom),28px)] animate-[bh-rise_.4s_ease-out]">
            <div className="relative flex size-40 items-center justify-center">
              <Rays color={color} />
              <div
                aria-hidden="true"
                className="relative flex size-[118px] items-center justify-center rounded-full animate-[bh-wiggle_2.4s_ease-in-out_infinite]"
                style={{ background: color, boxShadow: `0 8px 0 ${edge}, 0 0 0 8px #fff, 0 20px 40px -10px ${color}` }}
              >
                {summary.isDraw || !winner ? (
                  <span className="font-display text-[50px] leading-none text-white">=</span>
                ) : (
                  <PlayerShapeIcon shape={shapeForIndex(winnerIndex)} color={inkOn(winner.color)} size={50} />
                )}
              </div>
            </div>
            <DialogPrimitive.Title className="text-center font-display text-[46px] leading-none font-extrabold text-screen">
              {headline}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="-mt-1.5 text-[15px] font-extrabold text-screen-soft">
              {sub}
            </DialogPrimitive.Description>

            <ol className="card-3d flex w-full flex-col gap-2.5 px-3.5 py-3" aria-label="Final scores">
              {ranked.map(({ p, i }, place) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  <span className="w-[18px] font-display text-base font-extrabold text-label">{place + 1}</span>
                  <span
                    aria-hidden="true"
                    className="flex size-[34px] flex-none items-center justify-center rounded-full"
                    style={{ background: p.color }}
                  >
                    <PlayerShapeIcon shape={shapeForIndex(i)} color={inkOn(p.color)} size={13} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-extrabold text-ink">
                      {p.name}
                      {!p.active && <span className="text-label"> (left)</span>}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-[#F3EEF8]">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((p.score / total) * 100)}%`, background: p.color }} />
                    </div>
                  </div>
                  <span className="min-w-[34px] text-right font-display text-[28px] leading-none font-extrabold text-ink tabular-nums">
                    {p.score}
                  </span>
                </li>
              ))}
            </ol>

            <dl className="grid w-full grid-cols-4 gap-2">
              {stats.map(([k, v]) => (
                <div key={k} className="flex flex-col-reverse items-center gap-0.5 rounded-[18px] bg-white px-1 py-2.5 shadow-[0_4px_0_#EFE3CE]">
                  <dt className="text-[10px] font-black tracking-[1px] text-label uppercase">{k}</dt>
                  <dd className="font-display text-[19px] leading-[1.1] font-extrabold text-ink">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="flex-1" />
            {primary && (
              <Chunky tone="pink" lift={7} glow onClick={primary.run} className="h-[72px] w-full rounded-3xl text-[28px] leading-none">
                {primary.label}
              </Chunky>
            )}
            <div className={secondary ? 'grid w-full grid-cols-2 gap-3' : 'grid w-full'}>
              {secondary && (
                <Chunky onClick={secondary.run} className="h-[54px] rounded-[20px] text-lg">
                  {secondary.label}
                </Chunky>
              )}
              <Chunky onClick={onHome} className="h-[54px] rounded-[20px] text-lg">
                Home
              </Chunky>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
