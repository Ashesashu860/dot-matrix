'use client';

import { CUSTOM_LEVEL, LEVELS, MIN_DOTS, cellCount } from '@dots/game-engine';
import { useEffect, useState } from 'react';
import { Chunky } from '@/components/kit';
import { useBoardLimits } from '@/lib/board-limits';
import { playSound } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import { useSettings } from '@/stores/settings-store';

export interface BoardChoice {
  level: number;
  rows: number;
  columns: number;
}

const tile = 'flex flex-col items-center justify-center gap-0.5 rounded-[18px] transition-all duration-150';

/** Level tiles plus a custom-size option. `unlockedLevel` locks higher levels (CPU mode). */
export function BoardPicker({
  value,
  onChange,
  unlockedLevel,
  allowCustom = true,
  maxDots,
}: {
  value: BoardChoice;
  onChange(value: BoardChoice): void;
  unlockedLevel?: number;
  allowCustom?: boolean;
  /** Tighter cap than the screen allows (online rooms). */
  maxDots?: number;
}) {
  const sound = useSettings((s) => s.sound);
  const custom = value.level === CUSTOM_LEVEL;
  const screenLimits = useBoardLimits();
  const limits = maxDots
    ? { rows: Math.min(maxDots, screenLimits.rows), columns: Math.min(maxDots, screenLimits.columns) }
    : screenLimits;
  const fit = (v: BoardChoice) => ({ ...v, rows: Math.min(v.rows, limits.rows), columns: Math.min(v.columns, limits.columns) });

  // Keep a custom size within the limits when the screen size changes.
  useEffect(() => {
    if (custom && (value.rows > limits.rows || value.columns > limits.columns)) onChange(fit(value));
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Level">
        {LEVELS.map((l) => {
          const locked = unlockedLevel !== undefined && l.level > unlockedLevel;
          const selected = value.level === l.level;
          return (
            <Chunky
              key={l.level}
              role="radio"
              aria-checked={selected}
              aria-disabled={locked}
              aria-label={`Level ${l.level}, ${l.rows} by ${l.columns} dots${locked ? ', locked' : ''}`}
              tone={selected ? 'pink' : 'soft'}
              lift={4}
              onClick={() => {
                if (locked) {
                  if (sound) playSound('error');
                  return;
                }
                onChange({ level: l.level, rows: l.rows, columns: l.columns });
              }}
              className={cn(tile, 'h-[72px]', locked && 'shadow-none!')}
              style={locked ? { background: '#F1ECF6', color: '#A597BD' } : undefined}
            >
              <span className="text-[26px] leading-none">{l.level}</span>
              <span className="font-sans text-[11px] font-extrabold">{locked ? 'Locked' : `${l.rows}×${l.columns}`}</span>
            </Chunky>
          );
        })}
        {allowCustom && (
          <Chunky
            role="radio"
            aria-checked={custom}
            aria-label="Custom board size"
            tone={custom ? 'pink' : 'soft'}
            lift={4}
            onClick={() => onChange(fit({ level: CUSTOM_LEVEL, rows: value.rows, columns: value.columns }))}
            className={cn(tile, 'col-span-4 h-12 flex-row gap-2')}
          >
            <span className="text-lg leading-none">Custom size</span>
            {custom && (
              <span className="font-sans text-[11px] font-extrabold">
                {value.rows}×{value.columns}
              </span>
            )}
          </Chunky>
        )}
      </div>
      {custom && (
        <div className="flex flex-col gap-2 rounded-[18px] bg-soft p-3">
          <div className="flex items-center justify-center gap-2">
            <Stepper label="Rows" value={value.rows} max={limits.rows} onChange={(rows) => onChange({ ...value, rows })} />
            <span className="font-display text-xl text-label">×</span>
            <Stepper label="Columns" value={value.columns} max={limits.columns} onChange={(columns) => onChange({ ...value, columns })} />
          </div>
          <p className="text-center text-xs font-bold text-label">
            {cellCount(value.rows, value.columns)} boxes · up to {limits.rows}×{limits.columns}{maxDots ? '' : ' on this screen'} · custom boards
            don&apos;t unlock levels
          </p>
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange(v: number): void }) {
  const step = 'flex size-[38px] items-center justify-center rounded-[14px] text-2xl leading-none';
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number.parseInt(draft, 10);
    if (Number.isFinite(n)) onChange(Math.min(max, Math.max(MIN_DOTS, n)));
    setDraft(null);
  };
  return (
    <div className="flex flex-col items-center gap-1">
      <label htmlFor={`board-${label}`} className="card-label text-[10px]!">
        {label} (dots)
      </label>
      <div className="flex items-center gap-1.5">
        <Chunky tone="white" lift={3} className={step} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= MIN_DOTS} onClick={() => onChange(value - 1)}>
          −
        </Chunky>
        <input
          id={`board-${label}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-describedby={`board-${label}-range`}
          value={draft ?? String(value)}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 2))}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
          className="w-9 rounded-lg bg-transparent text-center font-display text-xl font-extrabold text-ink tabular-nums focus:bg-white focus:outline-2 focus:outline-[#7B5CFF]"
        />
        <Chunky tone="white" lift={3} className={step} aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </Chunky>
      </div>
      <span id={`board-${label}-range`} className="sr-only">
        {MIN_DOTS} to {max}
      </span>
    </div>
  );
}
