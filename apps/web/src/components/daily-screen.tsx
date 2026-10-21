'use client';

import { PUZZLE_HUMAN_ID, PUZZLE_SEARCH, puzzleNumber } from '@dots/cpu-engine';
import type { Puzzle } from '@dots/cpu-engine';
import { Loader2, Share2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { GameScreen } from '@/components/game/game-screen';
import { HintButton, useHint } from '@/components/game/use-hint';
import { Chunky } from '@/components/kit';
import { PageShell, Section } from '@/components/page-shell';
import { CpuController } from '@/controllers/cpu-controller';
import { newLocalGame } from '@/controllers/local-controller';
import { DAILY_ATTEMPTS, DAILY_HINTS, dailyStreak, isDone, shareText, untilNextPuzzle } from '@/lib/daily';
import { PUZZLE_BOT, humanScore, puzzleSetup } from '@/lib/puzzle-setup';
import { loadDaily, saveDaily } from '@/persistence/db';
import type { DailyProgress, DailyResult } from '@/persistence/db';
import { sharedRunner } from '@/workers/cpu-runner';

const NO_RESULT: DailyResult = { attempts: 0, solved: false, hints: 0 };

const KIND_COPY = {
  open: 'No safe lines are left: every move gives boxes away. Choose the right sacrifice.',
  respond: `${PUZZLE_BOT} just opened a chain. Take it all, or hand two back to keep control?`,
} as const;

async function share(text: string) {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast.success('Result copied');
  } catch (error) {
    // Dismissing the share sheet is not an error.
    if (error instanceof DOMException && error.name === 'AbortError') return;
    toast.error('Could not share');
  }
}

/** Today's puzzle: same position for everyone, three tries, one hint. */
export function DailyScreen() {
  const [no] = useState(() => puzzleNumber(new Date()));
  const [daily, setDaily] = useState<DailyProgress | null>(null);
  const [failed, setFailed] = useState(false);
  const [controller, setController] = useState<CpuController | null>(null);
  const dailyRef = useRef<DailyProgress | null>(null);

  const update = useCallback(
    (patch: Partial<DailyResult>) => {
      const current = dailyRef.current;
      if (!current) return;
      const next: DailyProgress = {
        ...current,
        results: { ...current.results, [no]: { ...NO_RESULT, ...current.results[no], ...patch } },
      };
      dailyRef.current = next;
      setDaily(next);
      void saveDaily(next);
    },
    [no],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await loadDaily();
      try {
        const puzzle = stored.puzzle?.no === no ? stored.puzzle : await sharedRunner().puzzle(no);
        const next = { ...stored, puzzle };
        if (cancelled) return;
        dailyRef.current = next;
        setDaily(next);
        if (stored.puzzle !== puzzle) void saveDaily(next);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [no]);

  useEffect(() => () => controller?.dispose(), [controller]);

  const puzzle = daily?.puzzle ?? null;
  const result = daily?.results[no] ?? NO_RESULT;

  const start = () => {
    if (!puzzle || isDone(result)) return;
    const setup = puzzleSetup(puzzle, puzzle.no);
    const state = newLocalGame(setup, crypto.randomUUID(), Date.now());
    const c = new CpuController(state, setup, sharedRunner(), {
      onFinished: (s) => {
        if (humanScore(s) >= puzzle.target) update({ solved: true });
      },
    });
    // An attempt counts once started, so quitting a lost position doesn't refund it.
    update({ attempts: result.attempts + 1 });
    setController(c);
  };

  if (controller && puzzle) {
    return (
      <DailyGame
        controller={controller}
        puzzle={puzzle}
        result={result}
        onUseHint={() => update({ hints: result.hints + 1 })}
        onRetry={() => {
          controller.dispose();
          setController(null);
          // Start the next attempt straight away.
          queueMicrotask(start);
        }}
        onExit={() => setController(null)}
      />
    );
  }

  const done = isDone(result);
  const left = DAILY_ATTEMPTS - result.attempts;
  const streak = daily ? dailyStreak(daily.results, no) : 0;

  return (
    <PageShell
      title={`Daily #${no}`}
      footer={
        puzzle &&
        (done ? (
          <Chunky tone="pink" lift={7} glow onClick={() => void share(shareText(no, result, `${location.origin}/daily`))} className="flex h-[72px] w-full items-center justify-center gap-2.5 rounded-3xl text-[26px]">
            <Share2 className="size-6" aria-hidden="true" />
            Share result
          </Chunky>
        ) : (
          <Chunky tone="pink" lift={7} glow onClick={start} className="flex h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-3xl">
            <span className="text-[26px] leading-none">{result.attempts ? 'Try again' : 'Start puzzle'}</span>
            <span className="font-sans text-xs font-extrabold">
              {left} {left === 1 ? 'try' : 'tries'} left
            </span>
          </Chunky>
        ))
      }
    >
      {!puzzle ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-screen-soft" aria-busy={!failed}>
          {failed ? (
            <p className="text-center font-extrabold">Couldn&apos;t build today&apos;s puzzle. Reload to try again.</p>
          ) : (
            <>
              <Loader2 className="size-8 animate-spin" />
              <p className="font-extrabold">Setting up today&apos;s board…</p>
            </>
          )}
        </div>
      ) : (
        <>
          <Section title="Goal">
            <p className="font-display text-[26px] leading-tight font-extrabold text-ink">
              Finish with {puzzle.target} of {puzzle.totalBoxes} {puzzle.shape ? 'points' : 'boxes'}
            </p>
            <p className="text-sm font-bold text-label">{KIND_COPY[puzzle.kind]}</p>
            {puzzle.shape && (
              <p className="text-sm font-bold text-label">Weekend board: gold boxes are worth 2 points.</p>
            )}
            <p className="text-sm font-bold text-label">
              {PUZZLE_BOT} plays perfectly from here, so you must too. Draw a line on a box&apos;s 3rd side and you hand it over.
            </p>
          </Section>

          <dl className="grid grid-cols-3 gap-2.5">
            {(
              [
                ['Tries', `${result.attempts}/${DAILY_ATTEMPTS}`],
                ['Hints', `${result.hints}/${DAILY_HINTS}`],
                ['Streak', streak],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="flex flex-col-reverse items-center gap-0.5 rounded-[20px] bg-white px-1.5 py-3.5 shadow-[0_4px_0_#EFE3CE]">
                <dt className="text-[10px] font-black tracking-[1px] text-label uppercase">{label}</dt>
                <dd className="font-display text-[28px] leading-none font-extrabold text-ink tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {done && (
            <Section title={result.solved ? 'Solved!' : 'Out of tries'}>
              <p className="text-sm font-bold text-label">
                {result.solved
                  ? `Cracked in ${result.attempts} ${result.attempts === 1 ? 'try' : 'tries'}.`
                  : 'This one was tough. Tomorrow is a new board.'}{' '}
                Next puzzle in {untilNextPuzzle(new Date())}.
              </p>
            </Section>
          )}
        </>
      )}
    </PageShell>
  );
}

function DailyGame({
  controller,
  puzzle,
  result,
  onUseHint,
  onRetry,
  onExit,
}: {
  controller: CpuController;
  puzzle: Puzzle;
  result: DailyResult;
  onUseHint(): void;
  onRetry(): void;
  onExit(): void;
}) {
  const view = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const { state } = view;
  const { myTurn, hintEdgeId, ask } = useHint(state, PUZZLE_HUMAN_ID, PUZZLE_SEARCH);
  const hintsLeft = DAILY_HINTS - result.hints;
  const finished = state.status === 'finished';
  const solved = finished && humanScore(state) >= puzzle.target;
  const triesLeft = DAILY_ATTEMPTS - result.attempts;

  return (
    <GameScreen
      controller={controller}
      perspectiveId={PUZZLE_HUMAN_ID}
      difficulty="Daily"
      title={`Daily #${puzzle.no}`}
      onExit={onExit}
      onRematch={!solved && triesLeft > 0 ? onRetry : undefined}
      hintEdgeId={hintEdgeId}
      goal={
        <p className="self-center rounded-full bg-amber px-3 py-1 text-xs font-extrabold text-ink">
          Goal: {humanScore(state)} / {puzzle.target} {puzzle.shape ? 'points' : 'boxes'}
        </p>
      }
      actions={
        hintsLeft > 0 &&
        myTurn && <HintButton label={`Hint (${hintsLeft} left)`} onClick={() => void ask().then((ok) => ok && onUseHint())} />
      }
      result={{
        headline: solved ? 'Solved!' : 'Not quite',
        sub: solved
          ? `${humanScore(state)} ${puzzle.shape ? 'points' : 'boxes'}: goal reached`
          : `${humanScore(state)} of ${puzzle.target} ${puzzle.shape ? 'points' : 'boxes'} needed`,
        success: solved,
        rematchLabel: `Try again (${triesLeft} left)`,
        extra: (solved || triesLeft <= 0) && (
          <Chunky
            tone="amber"
            onClick={() => void share(shareText(puzzle.no, result, `${location.origin}/daily`))}
            className="flex h-[54px] w-full items-center justify-center gap-2 rounded-[20px] text-lg"
          >
            <Share2 className="size-5" aria-hidden="true" />
            Share result
          </Chunky>
        ),
      }}
    />
  );
}
