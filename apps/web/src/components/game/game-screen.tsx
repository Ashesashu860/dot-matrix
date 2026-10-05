'use client';

import { cellCount, getLevel } from '@dots/game-engine';
import { ERROR_MESSAGES } from '@dots/protocol';
import type { ProtocolErrorCode } from '@dots/protocol';
import { Loader2, WifiOff } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { GameBoard } from '@/components/board/game-board';
import { Chunky, RoundButton } from '@/components/kit';
import { canInteract } from '@/controllers/types';
import type { GameController } from '@/controllers/types';
import { viewBoxSize } from '@/lib/board-geometry';
import { formatClock } from '@/lib/players';
import { useSettings } from '@/stores/settings-store';
import { ResultDialog } from './result-dialog';
import { Scoreboard } from './scoreboard';
import { TurnBanner } from './turn-banner';
import { useMoveFeedback } from './use-move-feedback';

export interface GameScreenProps {
  controller: GameController;
  /** Player whose perspective drives "You win" (CPU human / online self). */
  perspectiveId: string | null;
  /** CPU difficulty label, e.g. "Medium". */
  difficulty?: string;
  onExit(): void;
  onRematch?: () => void;
  onNextLevel?: () => void;
  onNewGame?: () => void;
  /** Online: leaving forfeits, so it is labelled and confirmed differently. */
  online?: boolean;
}

/** Room left for everything above and below the board. */
const BOARD_MAX_HEIGHT = 'max(240px, calc(100dvh - 24rem))';
/** Boards bigger than the level set may grow past the screen so boxes stay tappable. */
const LARGE_BOARD_DOTS = 12;
const MIN_BOX_PX = 22;

/** Elapsed play time; stops while paused and once the game ends. */
function useElapsed(startedAt: number | undefined, endedAt: number | undefined, paused: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const pausedTotal = useRef(0);
  const pausedSince = useRef<number | null>(null);

  useEffect(() => {
    pausedTotal.current = 0;
    pausedSince.current = null;
  }, [startedAt]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed((endedAt ?? Date.now()) - startedAt - pausedTotal.current);
    if (paused) {
      pausedSince.current ??= Date.now();
    } else if (pausedSince.current !== null) {
      pausedTotal.current += Date.now() - pausedSince.current;
      pausedSince.current = null;
    }
    tick();
    if (paused || endedAt) return;
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [startedAt, endedAt, paused]);

  return elapsed;
}

export function GameScreen({
  controller,
  perspectiveId,
  difficulty,
  onExit,
  onRematch,
  onNextLevel,
  onNewGame,
  online,
}: GameScreenProps) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const { state } = view;
  const [menuOpen, setMenuOpen] = useState(false);
  /** gameId whose result screen is open (a rematch has a new gameId, so it closes). */
  const [resultFor, setResultFor] = useState<string | null>(null);
  const resultOpen = state.status === 'finished' && resultFor === state.gameId;
  const announcement = useMoveFeedback(view, perspectiveId);
  const interactive = canInteract(view);
  const captureHints = useSettings((s) => s.captureHints);
  const elapsed = useElapsed(state.startedAt, state.endedAt, view.paused);

  // Show results shortly after the final move so the last celebration is visible.
  useEffect(() => {
    if (state.status !== 'finished') return;
    const gameId = state.gameId;
    const t = setTimeout(() => setResultFor(gameId), 1100);
    return () => clearTimeout(t);
  }, [state.status, state.gameId]);

  useEffect(() => {
    if (!view.error) return;
    const message = ERROR_MESSAGES[view.error as ProtocolErrorCode] ?? view.error;
    toast.error(message, { id: 'move-error' });
  }, [view.error, view.lastEvent]);

  const openMenu = useCallback(() => {
    setMenuOpen(true);
    if (!online) controller.pause();
  }, [controller, online]);

  const closeMenu = () => {
    setMenuOpen(false);
    if (!online) controller.resume();
  };

  // Escape / P opens the pause menu.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Escape' || e.key === 'p') && !menuOpen && state.status === 'playing') openMenu();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen, openMenu, state.status]);

  const isLevel = !!getLevel(state.level);
  const modeLabel = state.mode === 'cpu' ? `${difficulty ?? ''} CPU`.trim() : state.mode === 'local' ? 'Local' : 'Online';
  const total = cellCount(state.rows, state.columns);
  const claimed = state.players.reduce((sum, p) => sum + p.score, 0);
  const { width, height } = viewBoxSize({ rows: state.rows, columns: state.columns });
  // Large custom boards break out of the phone-width column (up to the viewport
  // width) and can be taller than the screen, so the page scrolls.
  const large = state.rows > LARGE_BOARD_DOTS || state.columns > LARGE_BOARD_DOTS;
  const boardMaxHeight = large ? `max(${BOARD_MAX_HEIGHT}, ${(state.rows - 1) * MIN_BOX_PX}px)` : BOARD_MAX_HEIGHT;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col gap-4 px-5 pt-[max(env(safe-area-inset-top),6px)] pb-[max(env(safe-area-inset-bottom),24px)]">
      <header className="flex items-center gap-3 pt-1.5">
        <RoundButton label="Pause" onClick={openMenu}>
          <span className="flex gap-[5px]" aria-hidden="true">
            <span className="h-4 w-[5px] rounded-[3px] bg-ink" />
            <span className="h-4 w-[5px] rounded-[3px] bg-ink" />
          </span>
        </RoundButton>
        <div className="flex min-w-0 flex-1 flex-col items-center text-center">
          <h1 className="font-display text-[26px] leading-none font-extrabold text-screen">
            {isLevel ? `Level ${state.level}` : 'Custom board'}
          </h1>
          <p className="text-xs font-extrabold whitespace-nowrap text-screen-soft">
            {state.rows}×{state.columns} · {modeLabel}
          </p>
        </div>
        <div className="flex w-16 flex-col items-end gap-1">
          <span
            className="rounded-full bg-white px-2.5 py-1.5 text-sm font-extrabold text-ink tabular-nums shadow-[0_3px_0_#EADFCB]"
            aria-label={`Time ${formatClock(elapsed)}`}
            role="timer"
          >
            {formatClock(elapsed)}
          </span>
          {online && view.connection === 'connected' && (
            <span className="flex items-center gap-1 text-[10px] font-black text-[#0F7A40]">
              <span className="size-[7px] rounded-full bg-green" />
              LIVE
            </span>
          )}
        </div>
      </header>

      {view.connection !== 'connected' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-2xl bg-amber px-3 py-2 text-sm font-extrabold text-ink shadow-[0_4px_0_#D98900]">
          {view.connection === 'offline' ? <WifiOff className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
          {view.connection === 'offline' ? 'You are offline. Reconnecting…' : 'Reconnecting…'}
        </div>
      )}

      <Scoreboard
        state={state}
        disconnectedPlayerIds={view.disconnectedPlayerIds}
        localPlayerIds={online ? view.controllablePlayerIds : []}
      />

      <main className="flex flex-1 flex-col justify-center">
        <div
          className="self-center rounded-[30px] bg-white p-3 shadow-[0_8px_0_#EFE3CE,0_20px_40px_-18px_rgba(43,27,74,.35)]"
          style={{ width: `min(${large ? 'calc(100vw - 40px)' : '100%'}, calc(${boardMaxHeight} * ${width / height} + 24px))` }}
        >
          <GameBoard
            key={state.gameId}
            state={state}
            interactive={interactive}
            pendingEdgeId={view.pendingEdgeId}
            lastEvent={view.lastEvent}
            maxHeight={boardMaxHeight}
            showHints={captureHints}
            onSelect={controller.submitMove.bind(controller)}
          />
        </div>
      </main>

      <div className="flex flex-col gap-1.5">
        <div
          className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-white p-0.5 shadow-[inset_0_2px_0_#EFE3CE]"
          role="progressbar"
          aria-label="Boxes claimed"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={claimed}
        >
          {state.players.map((p) => (
            <div
              key={p.id}
              className="h-full rounded-full transition-[width] duration-400 ease-[cubic-bezier(.3,1.6,.5,1)]"
              style={{ width: `${(p.score / total) * 100}%`, background: p.color }}
            />
          ))}
        </div>
        <p className="text-center text-xs font-extrabold text-screen-soft">
          {claimed} / {total} boxes claimed
        </p>
      </div>

      <TurnBanner view={view} />
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {state.status === 'finished' && !resultOpen && (
        <Chunky tone="pink" lift={6} onClick={() => setResultFor(state.gameId)} className="h-14 rounded-[20px] text-xl">
          Show results
        </Chunky>
      )}

      <DialogPrimitive.Root open={menuOpen} onOpenChange={(open) => (open ? openMenu() : closeMenu())}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(43,27,74,.55)] backdrop-blur-[6px]" />
          <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-48px)] max-w-[382px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-[32px] bg-white px-[22px] pt-7 pb-6 shadow-[0_10px_0_#E3D6EF] outline-none">
            <div className="flex w-full flex-col items-center gap-3 animate-[bh-turn_.3s_cubic-bezier(.3,1.6,.5,1)]">
              <DialogPrimitive.Title className="font-display text-[44px] leading-none font-extrabold text-ink">Paused</DialogPrimitive.Title>
              <DialogPrimitive.Description className={online ? 'text-center text-[13px] leading-snug font-extrabold text-label' : 'sr-only'}>
                {online ? 'Online matches keep running — opponents can still move.' : 'The game is paused.'}
              </DialogPrimitive.Description>
              <Chunky tone="pink" lift={6} onClick={closeMenu} className="mt-1.5 h-[62px] w-full rounded-[22px] text-2xl">
                Resume
              </Chunky>
              {controller.restart && (
                <Chunky
                  tone="soft"
                  onClick={() => {
                    controller.restart?.();
                    setMenuOpen(false);
                  }}
                  className="h-[54px] w-full rounded-[20px] text-xl"
                >
                  Restart
                </Chunky>
              )}
              <Chunky
                tone="soft"
                onClick={() => {
                  setMenuOpen(false);
                  onExit();
                }}
                className="h-[54px] w-full rounded-[20px] text-xl"
                style={online ? { color: '#D61F63' } : undefined}
              >
                {online ? 'Leave game (forfeit)' : 'Exit to home'}
              </Chunky>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <ResultDialog
        state={state}
        open={resultOpen}
        onOpenChange={(open) => setResultFor(open ? state.gameId : null)}
        perspectiveId={perspectiveId}
        modeLabel={state.mode === 'cpu' ? (difficulty ?? 'CPU') : modeLabel}
        onRematch={onRematch}
        onNextLevel={onNextLevel}
        onNewGame={onNewGame}
        onHome={onExit}
      />
    </div>
  );
}
