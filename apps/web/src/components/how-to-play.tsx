'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { PageShell } from '@/components/page-shell';
import { Button } from '@/components/ui/button';

const S = 60;
const P = 14;
const BLUE = '#2563eb';
const RED = '#e11d48';

function Dots({ cols, rows }: { cols: number; rows: number }) {
  return (
    <g className="fill-foreground">
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => <circle key={`${r}${c}`} cx={P + c * S} cy={P + r * S} r={5} />),
      )}
    </g>
  );
}

function Line({ x1, y1, x2, y2, color, delay = 0, loop = false }: {
  x1: number; y1: number; x2: number; y2: number; color: string; delay?: number; loop?: boolean;
}) {
  return (
    <motion.line
      x1={P + x1 * S}
      y1={P + y1 * S}
      x2={P + x2 * S}
      y2={P + y2 * S}
      stroke={color}
      strokeWidth={6}
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      whileInView={{ pathLength: 1 }}
      viewport={{ once: !loop }}
      transition={{ delay, duration: 0.35 }}
    />
  );
}

function Box({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) {
  return (
    <motion.rect
      x={P + x * S + 5}
      y={P + y * S + 5}
      width={S - 10}
      height={S - 10}
      rx={8}
      fill={color}
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 0.25 }}
      viewport={{ once: true }}
      transition={{ delay }}
    />
  );
}

function Card({ step, title, children, figure }: { step: number; title: string; children: React.ReactNode; figure: React.ReactNode }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm">
      <div className="shrink-0">{figure}</div>
      <div>
        <h2 className="font-semibold">
          <span className="mr-2 inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {step}
          </span>
          {title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{children}</p>
      </div>
    </article>
  );
}

export function HowToPlay() {
  const fig = (cols: number, rows: number, content: React.ReactNode, label: string) => (
    <svg width={(cols - 1) * S + P * 2} height={(rows - 1) * S + P * 2} role="img" aria-label={label}>
      {content}
      <Dots cols={cols} rows={rows} />
    </svg>
  );

  return (
    <PageShell
      title="How to Play"
      footer={
        <Button asChild size="lg" className="w-full">
          <Link href="/play/setup?mode=cpu">Try it vs the CPU</Link>
        </Button>
      }
    >
      <Card step={1} title="Draw a line" figure={fig(2, 2, <Line x1={0} y1={0} x2={1} y2={0} color={BLUE} />, 'A line between two dots')}>
        On your turn, connect two neighbouring dots — across or down, never diagonally or skipping a dot. Tap
        near a line; you don&apos;t need to be precise.
      </Card>

      <Card
        step={2}
        title="Close a box"
        figure={fig(
          2,
          2,
          <>
            <Line x1={0} y1={0} x2={1} y2={0} color={RED} />
            <Line x1={0} y1={0} x2={0} y2={1} color={RED} delay={0.3} />
            <Line x1={0} y1={1} x2={1} y2={1} color={RED} delay={0.6} />
            <Line x1={1} y1={0} x2={1} y2={1} color={BLUE} delay={1} />
            <Box x={0} y={0} color={BLUE} delay={1.3} />
          </>,
          'Blue draws the fourth side and wins the box',
        )}
      >
        Whoever draws the <strong>fourth side</strong> of a box claims it and scores one point — no matter who
        drew the other three.
      </Card>

      <Card
        step={3}
        title="Play again"
        figure={fig(
          3,
          2,
          <>
            <Line x1={0} y1={0} x2={2} y2={0} color={RED} />
            <Line x1={0} y1={1} x2={2} y2={1} color={RED} />
            <Line x1={0} y1={0} x2={0} y2={1} color={RED} />
            <Line x1={2} y1={0} x2={2} y2={1} color={RED} />
            <Line x1={1} y1={0} x2={1} y2={1} color={BLUE} delay={0.6} />
            <Box x={0} y={0} color={BLUE} delay={0.9} />
            <Box x={1} y={0} color={BLUE} delay={0.9} />
          </>,
          'One line completes two boxes at once',
        )}
      >
        Completing a box gives you <strong>another turn</strong>. One line can even complete two boxes at once.
      </Card>

      <Card step={4} title="Win the board" figure={fig(2, 2, <><Box x={0} y={0} color={BLUE} delay={0} /><Line x1={0} y1={0} x2={1} y2={0} color={BLUE} /><Line x1={0} y1={1} x2={1} y2={1} color={BLUE} /><Line x1={0} y1={0} x2={0} y2={1} color={BLUE} /><Line x1={1} y1={0} x2={1} y2={1} color={BLUE} /></>, 'A claimed box')}>
        When every box is claimed, the highest score wins. Equal top scores are a draw. Tip: avoid drawing the
        third side of a box — you&apos;re handing it to your opponent!
      </Card>
    </PageShell>
  );
}
