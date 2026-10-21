'use client';

import { puzzleNumber } from '@dots/cpu-engine';
import { getLevel } from '@dots/game-engine';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandLogo, Wordmark } from '@/components/brand-logo';
import { Chunky, Screen } from '@/components/kit';
import { InstallHint } from '@/components/pwa/install-hint';
import { InstallSheet } from '@/components/pwa/install-sheet';
import { MAX_STARS, currentStage, totalStars } from '@/lib/campaign';
import { DAILY_ATTEMPTS, dailyStreak, isDone } from '@/lib/daily';
import { navigate } from '@/lib/navigation';
import { loadDaily, loadSavedGame } from '@/persistence/db';
import type { DailyProgress, SavedGame } from '@/persistence/db';
import { useProgress } from '@/stores/progress-store';
import { useSession } from '@/stores/session-store';

const BLOBS: Array<[string, string, number, string, number]> = [
  // left, top, size, colour, delay
  ['-18%', '-6%', 210, '#FF3D7F', 0],
  ['67%', '13%', 170, '#1E9BFF', 0.4],
  ['-15%', '50%', 160, '#FFB21E', 0.8],
  ['69%', '66%', 200, '#21C46B', 1.2],
  ['36%', '85%', 130, '#FF3D7F', 1.6],
];
const SPECKS: Array<[string, string, number, string]> = [
  ['10%', '21%', 14, '#1E9BFF'],
  ['85%', '7%', 10, '#FFB21E'],
  ['82%', '39%', 16, '#FF3D7F'],
  ['8%', '39%', 10, '#21C46B'],
  ['51%', '5%', 8, '#FF3D7F'],
  ['15%', '71%', 12, '#1E9BFF'],
];

function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {BLOBS.map(([left, top, size, color, delay], i) => (
        <div
          key={`b${i}`}
          className="absolute rounded-full opacity-[.14]"
          style={{ left, top, width: size, height: size, background: color, animation: `bh-bob ${5 + i}s ease-in-out ${delay}s infinite` }}
        />
      ))}
      {SPECKS.map(([left, top, size, color], i) => (
        <div
          key={`d${i}`}
          className="absolute rounded-full"
          style={{ left, top, width: size, height: size, background: color, animation: `bh-bob ${3 + i * 0.5}s ease-in-out ${i * 0.3}s infinite` }}
        />
      ))}
    </div>
  );
}

/** Today's puzzle number, status and streak. */
function DailyCard() {
  const [today] = useState(() => puzzleNumber(new Date()));
  const [daily, setDaily] = useState<DailyProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadDaily().then((d) => !cancelled && setDaily(d));
    return () => {
      cancelled = true;
    };
  }, []);

  const result = daily?.results[today];
  const streak = daily ? dailyStreak(daily.results, today) : 0;
  const status = result?.solved
    ? 'Solved ✓'
    : isDone(result)
      ? 'Out of tries'
      : result?.attempts
        ? `${DAILY_ATTEMPTS - result.attempts} tries left`
        : 'New puzzle';

  return (
    <Chunky asChild tone="dark" lift={6} className="flex items-center gap-3 rounded-[22px] px-4 py-3">
      <Link href="/daily">
        <span aria-hidden="true" className="grid size-10 flex-none grid-cols-2 gap-1 rounded-xl bg-white p-2">
          <span className="rounded-[3px] bg-pink" />
          <span className="rounded-[3px] bg-blue" />
          <span className="rounded-[3px] bg-amber" />
          <span className="rounded-[3px] border-2 border-dashed border-ink/40" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-xl leading-tight">Daily Puzzle #{today}</span>
          <span className="font-sans text-xs font-extrabold opacity-80">
            {status}
            {streak > 0 && ` · ${streak} day streak`}
          </span>
        </span>
        <span className="text-[30px] leading-none" aria-hidden="true">›</span>
      </Link>
    </Chunky>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedGame | null>(null);
  const campaign = useProgress((s) => s.campaign);
  const stars = totalStars(campaign);
  const stage = currentStage(campaign);
  const streak = useProgress((s) => s.stats.currentWinStreak);

  useEffect(() => {
    let cancelled = false;
    void loadSavedGame().then((g) => !cancelled && setSaved(g));
    return () => {
      cancelled = true;
    };
  }, []);

  const resume = () => {
    if (!saved) return;
    useSession.getState().resume(saved);
    navigate(router, '/play');
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <Backdrop />
      <Screen className="gap-3.5 px-5 pb-[max(env(safe-area-inset-bottom),30px)]">
        <div className="flex items-center justify-between gap-2 pt-2.5">
          <span className="flex items-center gap-2 rounded-full bg-white py-[5px] pr-3.5 pl-[5px] shadow-[0_3px_0_#EADFCB]">
            <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-amber font-display text-[15px] leading-none font-extrabold text-ink">
              ★
            </span>
            <span className="text-[13px] font-extrabold whitespace-nowrap text-ink">
              {stars} / {MAX_STARS} stars
            </span>
          </span>
          <Link
            href="/stats"
            aria-label={`${streak} win streak. View stats`}
            className="flex items-center gap-[7px] rounded-full bg-white px-3.5 py-[7px] shadow-[0_3px_0_#EADFCB]"
          >
            <span className="size-2.5 rounded-full bg-pink" />
            <span className="text-[13px] font-extrabold whitespace-nowrap text-ink">{streak} win streak</span>
          </Link>
        </div>

        <section className="flex flex-1 flex-col items-center justify-center gap-1 py-4">
          <BrandLogo />
          <Wordmark />
          <p className="mt-4 text-xs font-black tracking-[2.5px] text-screen-soft uppercase">Connect · Capture · Conquer</p>
        </section>

        {saved && (
          <Chunky tone="dark" onClick={resume} className="flex items-center gap-3 rounded-[22px] px-4 py-3 text-left">
            <span aria-hidden="true" className="flex size-10 flex-none items-center justify-center rounded-full bg-white pl-1 text-lg text-ink">▶</span>
            <span className="flex min-w-0 flex-col">
              <span className="text-xl leading-tight">Resume game</span>
              <span className="truncate font-sans text-xs font-extrabold opacity-80">
                {saved.setup.campaignStage
                  ? `Stage ${saved.setup.campaignStage}`
                  : `${saved.state.mode === 'cpu' ? 'vs CPU' : 'Local'} · ${getLevel(saved.state.level) ? `Level ${saved.state.level}` : `${saved.state.rows}×${saved.state.columns}`}`}{' '}
                ·{' '}
                {saved.state.players.map((p) => `${p.name} ${p.score}`).join(' – ')}
              </span>
            </span>
          </Chunky>
        )}

        <DailyCard />

        <nav aria-label="Game modes" className="flex flex-col gap-3">
          <Chunky asChild tone="pink" lift={7} glow className="flex h-20 items-center gap-3.5 rounded-[26px] pr-5 pl-4">
            <Link href="/campaign">
              <span aria-hidden="true" className="flex size-12 flex-none items-center justify-center rounded-full bg-white pl-1 text-xl text-[#DB1F63]">▶</span>
              <span className="flex flex-1 flex-col gap-[3px]">
                <span className="text-[27px] leading-none">Campaign</span>
                <span className="font-sans text-[13px] font-extrabold">
                  {stars ? `Stage ${stage.id} · ${stars} ★` : 'Start with stage 1-1'}
                </span>
              </span>
              <span className="text-[34px] leading-none" aria-hidden="true">›</span>
            </Link>
          </Chunky>
          <div className="grid grid-cols-3 gap-2.5">
            <Chunky asChild tone="green" lift={6} className="flex h-[92px] flex-col items-start justify-end gap-1 rounded-3xl p-3">
              <Link href="/play/setup?mode=cpu">
                <span className="text-[19px] leading-none">Quick play</span>
                <span className="font-sans text-[11px] leading-tight font-extrabold">vs the bots</span>
              </Link>
            </Chunky>
            <Chunky asChild tone="blue" lift={6} className="flex h-[92px] flex-col items-start justify-end gap-1 rounded-3xl p-3">
              <Link href="/play/setup?mode=local">
                <span className="text-[19px] leading-none">Local Game</span>
                <span className="font-sans text-[11px] leading-tight font-extrabold">2–4 on one phone</span>
              </Link>
            </Chunky>
            <Chunky asChild tone="amber" lift={6} className="flex h-[92px] flex-col items-start justify-end gap-1 rounded-3xl p-3">
              <Link href="/online">
                <span className="text-[19px] leading-none">Online</span>
                <span className="font-sans text-[11px] leading-tight font-extrabold">Private rooms</span>
              </Link>
            </Chunky>
          </div>
        </nav>

        <nav aria-label="More" className="grid grid-cols-2 gap-3">
          <Chunky asChild className="flex h-[54px] items-center justify-center rounded-[20px] text-lg">
            <Link href="/how-to-play">How to play</Link>
          </Chunky>
          <Chunky asChild className="flex h-[54px] items-center justify-center rounded-[20px] text-lg">
            <Link href="/settings">Settings</Link>
          </Chunky>
        </nav>

        <InstallHint />
        <InstallSheet />
      </Screen>
    </div>
  );
}
