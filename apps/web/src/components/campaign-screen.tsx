'use client';

import { Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Chunky } from '@/components/kit';
import { PageShell } from '@/components/page-shell';
import {
  CHAPTERS,
  boxesIn,
  chapterUnlocked,
  currentStage,
  goalLabel,
  stageSetup,
  stageUnlocked,
  stagesOf,
  totalStars,
} from '@/lib/campaign';
import type { Stage } from '@/lib/campaign';
import { navigate } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useProgress } from '@/stores/progress-store';
import { useSession } from '@/stores/session-store';

const randomSeed = () => Math.floor(Math.random() * 2 ** 31);

function Stars({ n, className }: { n: number; className?: string }) {
  return (
    <span className={cn('tracking-[1px]', className)} aria-label={`${n} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden="true" className={i < n ? 'text-amber' : 'opacity-30'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** Chapters of stages; each stage has three goals worth a star each. */
export function CampaignScreen() {
  const router = useRouter();
  const { campaign, hydrated } = useProgress();
  const stars = totalStars(campaign);
  const next = currentStage(campaign);

  const play = async (stage: Stage) => {
    await useSession.getState().startLocal(stageSetup(stage, randomSeed()));
    navigate(router, '/play');
  };

  return (
    <PageShell
      title="Campaign"
      right={
        <span className="rounded-full bg-white px-3 py-2 text-sm font-extrabold text-ink shadow-[0_3px_0_#EADFCB]">
          <span className="text-amber">★</span> {stars}
        </span>
      }
      footer={
        hydrated && (
          <Chunky tone="pink" lift={7} glow onClick={() => void play(next)} className="flex h-[72px] w-full flex-col items-center justify-center gap-0.5 rounded-3xl">
            <span className="text-[26px] leading-none">Play stage {next.id}</span>
            <span className="font-sans text-xs font-extrabold">
              {next.rows}×{next.columns} dots · {boxesIn(next)} boxes · {next.bots.length > 1 ? `${next.bots.length} bots` : '1 bot'}
            </span>
          </Chunky>
        )
      }
    >
      {CHAPTERS.map((chapter) => {
        const open = chapterUnlocked(campaign, chapter.number);
        const stages = stagesOf(chapter.number);
        const earned = stages.reduce((sum, s) => sum + (campaign.stars[s.id] ?? 0), 0);
        return (
          <section key={chapter.number} className="card-3d flex flex-col gap-3 p-4" aria-label={`Chapter ${chapter.number}: ${chapter.title}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h2 className="card-label">Chapter {chapter.number}</h2>
                <p className="font-display text-[22px] leading-tight font-extrabold text-ink">{chapter.title}</p>
                <p className="text-[13px] font-bold text-label">{chapter.blurb}</p>
              </div>
              <span className="flex-none text-sm font-extrabold whitespace-nowrap text-ink">
                {open ? (
                  <>
                    <span className="text-amber">★</span> {earned}/{stages.length * 3}
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-label">
                    <Lock className="size-3.5" aria-hidden="true" />
                    {chapter.starsToUnlock} ★
                  </span>
                )}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2" role="list">
              {stages.map((stage) => {
                const unlocked = stageUnlocked(campaign, stage);
                const got = campaign.stars[stage.id] ?? 0;
                return (
                  <Chunky
                    key={stage.id}
                    role="listitem"
                    tone={stage.id === next.id ? 'pink' : got ? 'soft' : 'white'}
                    lift={4}
                    disabled={!unlocked}
                    onClick={() => void play(stage)}
                    aria-label={`Stage ${stage.id}${unlocked ? `, ${got} stars. Goals: ${stage.goals.map(goalLabel).join('; ')}` : ', locked'}`}
                    className="flex h-[68px] flex-col items-center justify-center gap-0.5 rounded-[18px]"
                  >
                    <span className="text-xl leading-none">{stage.id}</span>
                    {unlocked ? <Stars n={got} className="text-[13px]" /> : <Lock className="size-3.5" aria-hidden="true" />}
                  </Chunky>
                );
              })}
            </div>
          </section>
        );
      })}
    </PageShell>
  );
}
