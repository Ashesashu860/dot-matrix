'use client';

import { getLevel } from '@dots/game-engine';
import { ERROR_MESSAGES } from '@dots/protocol';
import type { ProtocolErrorCode } from '@dots/protocol';
import { ArrowLeft, Loader2, LogOut, Pause, Play, RotateCcw, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { GameBoard } from '@/components/board/game-board';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { canInteract } from '@/controllers/types';
import type { GameController } from '@/controllers/types';
import { ResultDialog } from './result-dialog';
import { Scoreboard } from './scoreboard';
import { TurnBanner } from './turn-banner';
import { useMoveFeedback } from './use-move-feedback';

export interface GameScreenProps {
  controller: GameController;
  /** Player whose perspective drives "You win" (CPU human / online self). */
  perspectiveId: string | null;
  onExit(): void;
  onRematch?: () => void;
  onNextLevel?: () => void;
  /** Online: leaving forfeits, so it is labelled and confirmed differently. */
  online?: boolean;
}

export function GameScreen({ controller, perspectiveId, onExit, onRematch, onNextLevel, online }: GameScreenProps) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const { state } = view;
  const [menuOpen, setMenuOpen] = useState(false);
  /** gameId whose result dialog is open (a rematch has a new gameId, so it closes). */
  const [resultFor, setResultFor] = useState<string | null>(null);
  const resultOpen = state.status === 'finished' && resultFor === state.gameId;
  const announcement = useMoveFeedback(view);
  const interactive = canInteract(view);

  // Show results shortly after the final move so the last animation is visible.
  useEffect(() => {
    if (state.status !== 'finished') return;
    const gameId = state.gameId;
    const t = setTimeout(() => setResultFor(gameId), 700);
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

  const levelLabel = getLevel(state.level) ? `Level ${state.level}` : `${state.rows}×${state.columns}`;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-3 px-3 pb-6 pt-[max(env(safe-area-inset-top),0.75rem)]">
      <header className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={openMenu} aria-label="Back">
          <ArrowLeft />
        </Button>
        <div className="text-center">
          <h1 className="text-base font-bold tracking-tight">Dots Matrix</h1>
          <p className="text-xs text-muted-foreground">{levelLabel}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={openMenu} aria-label="Pause menu" disabled={state.status !== 'playing'}>
          <Pause />
        </Button>
      </header>

      {view.connection !== 'connected' && (
        <div role="status" className="flex items-center justify-center gap-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
          {view.connection === 'offline' ? <WifiOff className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
          {view.connection === 'offline' ? 'You are offline. Reconnecting…' : 'Reconnecting…'}
        </div>
      )}

      <Scoreboard
        state={state}
        disconnectedPlayerIds={view.disconnectedPlayerIds}
        localPlayerIds={online ? view.controllablePlayerIds : []}
      />

      <main className="flex flex-1 items-center justify-center">
        <GameBoard
          state={state}
          interactive={interactive}
          pendingEdgeId={view.pendingEdgeId}
          lastEvent={view.lastEvent}
          onSelect={controller.submitMove.bind(controller)}
          className="max-h-[calc(100dvh-15rem)] max-w-full drop-shadow-sm"
        />
      </main>

      <TurnBanner view={view} />
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </div>

      {state.status === 'finished' && !resultOpen && (
        <Button size="lg" onClick={() => setResultFor(state.gameId)}>
          Show results
        </Button>
      )}

      <Sheet open={menuOpen} onOpenChange={(open) => (open ? openMenu() : closeMenu())}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[max(env(safe-area-inset-bottom),1rem)]">
          <SheetHeader>
            <SheetTitle>{online ? 'Menu' : 'Paused'}</SheetTitle>
            <SheetDescription>
              {online ? 'The online game keeps running while this menu is open.' : 'The game is paused.'}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter className="gap-2">
            <Button size="lg" onClick={closeMenu}>
              <Play /> Resume
            </Button>
            {controller.restart && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => {
                  controller.restart?.();
                  setMenuOpen(false);
                }}
              >
                <RotateCcw /> Restart
              </Button>
            )}
            <Button
              size="lg"
              variant={online ? 'destructive' : 'ghost'}
              onClick={() => {
                setMenuOpen(false);
                onExit();
              }}
            >
              <LogOut /> {online ? 'Leave game (forfeit)' : 'Exit to home'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ResultDialog
        state={state}
        open={resultOpen}
        onOpenChange={(open) => setResultFor(open ? state.gameId : null)}
        perspectiveId={perspectiveId}
        onRematch={onRematch}
        onNextLevel={onNextLevel}
        onHome={onExit}
      />
    </div>
  );
}
