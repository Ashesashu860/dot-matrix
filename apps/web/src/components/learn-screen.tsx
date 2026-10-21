'use client';

import { PUZZLE_HUMAN_ID, PUZZLE_SEARCH } from '@dots/cpu-engine';
import { Check } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { GameScreen } from '@/components/game/game-screen';
import { HintButton, useHint } from '@/components/game/use-hint';
import { Chunky } from '@/components/kit';
import { PageShell, Section } from '@/components/page-shell';
import { CpuController } from '@/controllers/cpu-controller';
import { newLocalGame } from '@/controllers/local-controller';
import { LESSONS } from '@/lib/lessons';
import type { Lesson } from '@/lib/lessons';
import { PUZZLE_BOT, humanScore, puzzleSetup } from '@/lib/puzzle-setup';
import { loadLessons, saveLessons } from '@/persistence/db';
import { sharedRunner } from '@/workers/cpu-runner';

/** Short interactive lessons on chains, each a position against a perfect bot. */
export function LearnScreen() {
  const [done, setDone] = useState<string[]>([]);
  const [selected, setSelected] = useState<Lesson | null>(null);
  const [controller, setController] = useState<CpuController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadLessons().then((l) => !cancelled && setDone(l.done));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => controller?.dispose(), [controller]);

  const complete = (id: string) =>
    setDone((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      void saveLessons({ done: next });
      return next;
    });

  const start = (lesson: Lesson) => {
    const setup = puzzleSetup(lesson.position, 1);
    const c = new CpuController(newLocalGame(setup, crypto.randomUUID(), Date.now()), setup, sharedRunner(), {
      onFinished: (s) => {
        if (humanScore(s) >= lesson.target) complete(lesson.id);
      },
    });
    setSelected(lesson);
    setController(c);
  };

  if (controller && selected) {
    const index = LESSONS.indexOf(selected);
    const following = LESSONS[index + 1];
    return (
      <LessonGame
        controller={controller}
        lesson={selected}
        number={index + 1}
        onExit={() => setController(null)}
        onNext={following ? () => start(following) : undefined}
      />
    );
  }

  const lesson = selected ?? LESSONS.find((l) => !done.includes(l.id)) ?? LESSONS[0]!;

  return (
    <PageShell
      title="Learn chains"
      footer={
        <Chunky tone="pink" lift={7} glow onClick={() => start(lesson)} className="flex h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-3xl">
          <span className="text-[26px] leading-none">Play lesson {LESSONS.indexOf(lesson) + 1}</span>
          <span className="font-sans text-xs font-extrabold">{lesson.title}</span>
        </Chunky>
      }
    >
      <Section title={`Lesson ${LESSONS.indexOf(lesson) + 1}: ${lesson.title}`}>
        {lesson.intro.map((p) => (
          <p key={p} className="text-[15px] font-bold text-ink">
            {p}
          </p>
        ))}
        <p className="text-sm font-bold text-label">
          Goal: finish with {lesson.target} of {lesson.totalBoxes} boxes. {PUZZLE_BOT} plays perfectly.
        </p>
      </Section>
      <ol className="flex flex-col gap-2" aria-label="Lessons">
        {LESSONS.map((l, i) => {
          const finished = done.includes(l.id);
          return (
            <li key={l.id}>
              <Chunky
                tone={l === lesson ? 'dark' : 'white'}
                lift={4}
                onClick={() => setSelected(l)}
                aria-current={l === lesson}
                className="flex h-14 w-full items-center gap-3 rounded-[18px] px-4 text-left text-lg"
              >
                <span className="w-5 font-display">{i + 1}</span>
                <span className="flex-1">{l.title}</span>
                {finished && (
                  <span className="flex items-center gap-1 font-sans text-xs font-extrabold text-green">
                    <Check className="size-4" aria-hidden="true" />
                    Done
                  </span>
                )}
              </Chunky>
            </li>
          );
        })}
      </ol>
    </PageShell>
  );
}

function LessonGame({
  controller,
  lesson,
  number,
  onExit,
  onNext,
}: {
  controller: CpuController;
  lesson: Lesson;
  number: number;
  onExit(): void;
  onNext?: () => void;
}) {
  const { state } = useSyncExternalStore(controller.subscribe, controller.getView, controller.getView);
  const { myTurn, hintEdgeId, ask } = useHint(state, PUZZLE_HUMAN_ID, PUZZLE_SEARCH);
  const score = humanScore(state);
  const passed = state.status === 'finished' && score >= lesson.target;

  return (
    <GameScreen
      controller={controller}
      perspectiveId={PUZZLE_HUMAN_ID}
      difficulty="Lesson"
      title={`Lesson ${number}`}
      onExit={onExit}
      onRematch={() => controller.restart()}
      onNextLevel={passed ? onNext : undefined}
      onNewGame={passed && !onNext ? onExit : undefined}
      hintEdgeId={hintEdgeId}
      goal={
        <p className="self-center text-center text-xs font-extrabold text-screen-soft">
          <span className="rounded-full bg-amber px-3 py-1 text-ink">
            Goal: {score} / {lesson.target} boxes
          </span>
          <span className="mt-2 block">{lesson.tip}</span>
        </p>
      }
      actions={myTurn && <HintButton label="Show me" onClick={() => void ask()} />}
      result={{
        headline: passed ? 'Lesson complete!' : 'Not quite',
        sub: passed ? lesson.title : `${score} of ${lesson.target} boxes needed`,
        success: passed,
        rematchLabel: passed ? 'Play again' : 'Try again',
      }}
    />
  );
}
