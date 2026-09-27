'use client';

import { MAX_LEVEL, getLevel } from '@dots/game-engine';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GameScreen } from '@/components/game/game-screen';
import type { GameController } from '@/controllers/types';
import { navigate } from '@/lib/navigation';
import { clearSavedGame, loadSavedGame } from '@/persistence/db';
import { useSession } from '@/stores/session-store';

/** Local and CPU games. Resumes the saved game after a reload. */
export function PlayScreen() {
  const router = useRouter();
  const controller = useSession((s) => s.controller);
  const setup = useSession((s) => s.setup);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (controller && setup) return;
    let cancelled = false;
    void loadSavedGame().then((saved) => {
      if (cancelled) return;
      if (saved) useSession.getState().resume(saved);
      else navigate(router, '/', { replace: true });
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [controller, setup, router]);

  if (!controller || !setup) {
    return (
      <div className="flex min-h-dvh items-center justify-center" aria-busy="true">
        {checked ? null : <Loader2 className="size-8 animate-spin text-muted-foreground" />}
      </div>
    );
  }
  return <ActiveGame controller={controller} />;
}

function ActiveGame({ controller }: { controller: GameController }) {
  const router = useRouter();
  const setup = useSession((s) => s.setup)!;
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const { state } = view;
  const human = setup.create.mode === 'cpu' ? setup.create.players.find((p) => p.type === 'human') : undefined;
  const humanWon = human !== undefined && !state.isDraw && state.winnerIds?.includes(human.id);
  const next = getLevel(state.level + 1);
  const canAdvance = setup.create.mode === 'cpu' && humanWon && getLevel(state.level) && state.level < MAX_LEVEL && next;

  const exit = () => {
    // A finished game is already recorded; an unfinished one stays saved for "Resume".
    if (state.status === 'finished') void clearSavedGame();
    useSession.getState().end();
    navigate(router, '/');
  };

  return (
    <GameScreen
      controller={controller}
      perspectiveId={human?.id ?? null}
      onExit={exit}
      onRematch={() => controller.restart?.()}
      onNextLevel={
        canAdvance && next
          ? () =>
              void useSession.getState().startLocal({
                ...setup,
                create: { ...setup.create, level: next.level, rows: next.rows, columns: next.columns },
                seed: setup.seed + 1,
              })
          : undefined
      }
    />
  );
}
