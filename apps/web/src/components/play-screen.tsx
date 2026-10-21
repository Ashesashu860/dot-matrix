'use client';

import { MAX_LEVEL, getLevel } from '@dots/game-engine';
import type { GameState } from '@dots/game-engine';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { GameScreen } from '@/components/game/game-screen';
import type { ResultOverrides } from '@/components/game/result-dialog';
import { TurningPointCard } from '@/components/game/turning-point';
import { HintButton, useHint } from '@/components/game/use-hint';
import { LocalController } from '@/controllers/local-controller';
import type { LocalGameSetup, LoggedMove } from '@/controllers/local-controller';
import type { GameController } from '@/controllers/types';
import {
  chapterUnlocked,
  getStage,
  goalLabel,
  goalShort,
  goalsMet,
  nextStage,
  stageSetup,
} from '@/lib/campaign';
import type { Stage } from '@/lib/campaign';
import { navigate } from '@/lib/navigation';
import { clearSavedGame, loadSavedGame } from '@/persistence/db';
import { useProgress } from '@/stores/progress-store';
import { useSession } from '@/stores/session-store';

const DIFFICULTY_LABEL = { easy: 'Easy', medium: 'Medium', hard: 'Hard' } as const;

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
        {checked ? null : <Loader2 className="size-8 animate-spin text-screen-soft" />}
      </div>
    );
  }
  return <ActiveGame controller={controller} />;
}

const NO_LOG: readonly LoggedMove[] = [];
const logOf = (controller: GameController) =>
  controller instanceof LocalController ? controller.getLog() : NO_LOG;

/** The profile playing a campaign game, carried into the next stage. */
function profilePlayer(setup: LocalGameSetup) {
  const profile = useProgress.getState().book.profiles.find((p) => p.id === setup.profileId);
  return profile && { id: profile.id, name: profile.name };
}

/** Stars, goal checklist and the next stage for a finished campaign game. */
function useCampaignGame(
  stage: Stage | undefined,
  controller: GameController,
  state: GameState,
  review: ReactNode,
) {
  const progress = useProgress((s) => s.campaign);
  if (!stage) return null;
  const log = logOf(controller);
  const met = state.status === 'finished' ? goalsMet(stage, state, log) : [false, false, false];
  const stars = met.filter(Boolean).length;
  const following = nextStage(stage.id);
  // Stars are saved as the game ends, so a clear opens the next stage straight away.
  const nextOpen =
    following &&
    stars > 0 &&
    (following.chapter === stage.chapter || chapterUnlocked(progress, following.chapter));
  const result: ResultOverrides = {
    headline: stars ? (stars === 3 ? 'Perfect!' : 'Stage cleared!') : undefined,
    sub: stars ? `${stars} of 3 stars` : 'No stars this time. Rematch?',
    success: stars > 0,
    extra: (
      <>
        <ul className="card-3d flex w-full flex-col gap-2 px-4 py-3" aria-label="Goals">
          {stage.goals.map((goal, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm font-extrabold text-ink">
              <span
                aria-hidden="true"
                className={met[i] ? 'text-xl text-amber' : 'text-xl text-[#D9CFE6]'}
              >
                ★
              </span>
              <span className="flex-1">{goalLabel(goal)}</span>
              <span className="sr-only">{met[i] ? 'done' : 'not done'}</span>
            </li>
          ))}
        </ul>
        {review}
      </>
    ),
  };
  return { result, next: nextOpen ? following : undefined };
}

function ActiveGame({ controller }: { controller: GameController }) {
  const router = useRouter();
  const setup = useSession((s) => s.setup)!;
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const { state } = view;
  const human =
    setup.create.mode === 'cpu' ? setup.create.players.find((p) => p.type === 'human') : undefined;
  const humanWon = human !== undefined && !state.isDraw && state.winnerIds?.includes(human.id);
  const next = getLevel(state.level + 1);
  const canAdvance =
    setup.create.mode === 'cpu' &&
    humanWon &&
    getLevel(state.level) &&
    state.level < MAX_LEVEL &&
    next;

  const stage = setup.campaignStage ? getStage(setup.campaignStage) : undefined;
  const log = state.status === 'finished' ? logOf(controller) : NO_LOG;
  const review = human && state.players.length === 2 && state.status === 'finished' && (
    <TurningPointCard state={state} setup={setup} log={log} playerId={human.id} />
  );
  const campaign = useCampaignGame(stage, controller, state, review);
  const hint = useHint(state, human?.id ?? '');
  const [hintedGame, setHintedGame] = useState<string | null>(null);

  const exit = () => {
    // A finished game is already recorded; an unfinished one stays saved for "Resume".
    if (state.status === 'finished') void clearSavedGame();
    useSession.getState().end();
    navigate(router, stage ? '/campaign' : '/');
  };

  if (stage && campaign) {
    return (
      <GameScreen
        controller={controller}
        perspectiveId={human?.id ?? null}
        title={`Stage ${stage.id}`}
        onExit={exit}
        onRematch={() => controller.restart?.()}
        onNewGame={() => {
          useSession.getState().end();
          navigate(router, '/campaign');
        }}
        onNextLevel={
          campaign.next
            ? () =>
                void useSession.getState().startLocal(
                  stageSetup(campaign.next!, setup.seed + 1, profilePlayer(setup)),
                )
            : undefined
        }
        goal={
          <p className="text-center text-[11px] font-extrabold text-screen-soft">
            {stage.goals.map((g, i) => (
              <span key={i} className="whitespace-nowrap">
                {i > 0 && ' · '}
                <span className="text-amber" aria-hidden="true">
                  ★
                </span>{' '}
                {goalShort(g)}
              </span>
            ))}
          </p>
        }
        hintEdgeId={hint.hintEdgeId}
        actions={
          hint.myTurn &&
          hintedGame !== state.gameId && (
            <HintButton
              label="Hint (1 per game)"
              onClick={() => void hint.ask().then((ok) => ok && setHintedGame(state.gameId))}
            />
          )
        }
        result={campaign.result}
      />
    );
  }

  return (
    <GameScreen
      controller={controller}
      perspectiveId={human?.id ?? null}
      difficulty={setup.difficulty ? DIFFICULTY_LABEL[setup.difficulty] : undefined}
      onExit={exit}
      onNewGame={() => {
        void clearSavedGame();
        useSession.getState().end();
        navigate(router, `/play/setup?mode=${setup.create.mode}`);
      }}
      onRematch={() => controller.restart?.()}
      result={review ? { extra: review } : undefined}
      onNextLevel={
        canAdvance && next
          ? () =>
              void useSession.getState().startLocal({
                ...setup,
                create: {
                  ...setup.create,
                  level: next.level,
                  rows: next.rows,
                  columns: next.columns,
                },
                seed: setup.seed + 1,
              })
          : undefined
      }
    />
  );
}
