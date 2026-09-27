'use client';

import { motion } from 'motion/react';

const LINES: Array<[number, number, number, number, string]> = [
  [0, 0, 1, 0, '#2563eb'],
  [1, 0, 2, 0, '#e11d48'],
  [0, 0, 0, 1, '#2563eb'],
  [1, 0, 1, 1, '#059669'],
  [0, 1, 1, 1, '#2563eb'],
  [2, 0, 2, 1, '#e11d48'],
  [1, 1, 2, 1, '#e11d48'],
];

/** Animated mini-board used as the brand mark. */
export function BrandLogo({ size = 120 }: { size?: number }) {
  const s = 40;
  const p = 10;
  return (
    <svg width={size} height={(size * (s + p * 2)) / (s * 2 + p * 2)} viewBox={`0 0 ${s * 2 + p * 2} ${s + p * 2}`} aria-hidden="true">
      <motion.rect
        x={p + 3}
        y={p + 3}
        width={s - 6}
        height={s - 6}
        rx={6}
        fill="#2563eb"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 0.25, scale: 1 }}
        transition={{ delay: 1.1, type: 'spring' }}
        style={{ transformOrigin: `${p + s / 2}px ${p + s / 2}px` }}
      />
      <motion.rect
        x={p + s + 3}
        y={p + 3}
        width={s - 6}
        height={s - 6}
        rx={6}
        fill="#e11d48"
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 0.25, scale: 1 }}
        transition={{ delay: 1.4, type: 'spring' }}
        style={{ transformOrigin: `${p + s * 1.5}px ${p + s / 2}px` }}
      />
      {LINES.map(([x1, y1, x2, y2, color], i) => (
        <motion.line
          key={i}
          x1={p + x1 * s}
          y1={p + y1 * s}
          x2={p + x2 * s}
          y2={p + y2 * s}
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ delay: 0.15 * i, duration: 0.25 }}
        />
      ))}
      {[0, 1, 2].flatMap((x) =>
        [0, 1].map((y) => <circle key={`${x}${y}`} cx={p + x * s} cy={p + y * s} r={4.5} className="fill-foreground" />),
      )}
    </svg>
  );
}
