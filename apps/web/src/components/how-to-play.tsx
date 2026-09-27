'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Chunky } from '@/components/kit';
import { PageShell } from '@/components/page-shell';

function Step({ title, figure, label, children }: { title: string; figure: ReactNode; label: string; children: ReactNode }) {
  return (
    <article className="card-3d flex items-center gap-3.5 p-3.5">
      <div role="img" aria-label={label} className="flex h-20 w-24 flex-none items-center justify-center rounded-[18px] bg-[#FFF4E2]">
        {figure}
      </div>
      <div className="flex flex-col gap-[3px]">
        <h2 className="font-display text-xl leading-[1.1] font-extrabold text-ink">{title}</h2>
        <p className="text-sm leading-[1.35] font-bold text-[#5E4F7D]">{children}</p>
      </div>
    </article>
  );
}

export function HowToPlay() {
  return (
    <PageShell
      title="How to play"
      footer={
        <Chunky asChild tone="pink" lift={7} className="flex h-[68px] w-full items-center justify-center rounded-3xl text-[26px] leading-none">
          <Link href="/play/setup?mode=cpu">Got it — let&apos;s play</Link>
        </Chunky>
      }
    >
      <Step
        title="1 · Draw a line"
        label="A pink line joining two dots"
        figure={
          <svg width="80" height="40" viewBox="0 0 80 40" aria-hidden="true">
            <line x1="14" y1="20" x2="66" y2="20" stroke="#FF3D7F" strokeWidth="8" strokeLinecap="round" />
            <circle cx="14" cy="20" r="7" fill="#2B1B4A" />
            <circle cx="66" cy="20" r="7" fill="#2B1B4A" />
          </svg>
        }
      >
        Tap between two neighbouring dots. Across or down — no diagonals.
      </Step>
      <Step
        title="2 · Close a box"
        label="Drawing the fourth side captures the box"
        figure={
          <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
            <rect x="15" y="15" width="34" height="34" rx="7" fill="#FF3D7F" />
            <line x1="8" y1="8" x2="56" y2="8" stroke="#CFC3E0" strokeWidth="6" strokeLinecap="round" />
            <line x1="8" y1="8" x2="8" y2="56" stroke="#CFC3E0" strokeWidth="6" strokeLinecap="round" />
            <line x1="8" y1="56" x2="56" y2="56" stroke="#CFC3E0" strokeWidth="6" strokeLinecap="round" />
            <line x1="56" y1="8" x2="56" y2="56" stroke="#FF3D7F" strokeWidth="6" strokeLinecap="round" />
            <circle cx="8" cy="8" r="5" fill="#2B1B4A" />
            <circle cx="56" cy="8" r="5" fill="#2B1B4A" />
            <circle cx="8" cy="56" r="5" fill="#2B1B4A" />
            <circle cx="56" cy="56" r="5" fill="#2B1B4A" />
          </svg>
        }
      >
        Draw the 4th side of a square and it&apos;s yours — worth 1 point.
      </Step>
      <Step
        title="3 · Go again"
        label="Plus one point and play again"
        figure={
          <div className="flex flex-col items-center gap-1" aria-hidden="true">
            <span className="font-display text-[26px] leading-none font-extrabold text-[#DB1F63]">+1</span>
            <span className="-rotate-4 rounded-lg bg-[#0A73CC] px-2 py-[5px] font-display text-[11px] leading-none font-extrabold text-white">
              PLAY AGAIN!
            </span>
          </div>
        }
      >
        Closing a box earns an extra turn. Chain them for combos.
      </Step>
      <Step
        title="4 · Most boxes wins"
        label="Pink owns three of four boxes"
        figure={
          <div className="grid grid-cols-[24px_24px] gap-1" aria-hidden="true">
            <div className="h-6 rounded-md bg-pink" />
            <div className="h-6 rounded-md bg-pink" />
            <div className="h-6 rounded-md bg-blue" />
            <div className="h-6 rounded-md bg-pink" />
          </div>
        }
      >
        When every box is claimed, top score wins. Ties are a draw.
      </Step>
      <p className="px-2.5 py-1 text-center text-[13px] leading-[1.4] font-extrabold text-screen-soft">
        Tip: avoid drawing the 3rd side of a box — you&apos;ll hand it to your opponent.
      </p>
    </PageShell>
  );
}
