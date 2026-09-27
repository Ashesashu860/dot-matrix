'use client';

import { CUSTOM_LEVEL, LEVELS, MAX_DOTS, MIN_DOTS, cellCount } from '@dots/game-engine';
import { Lock, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface BoardChoice {
  level: number;
  rows: number;
  columns: number;
}

/** Level grid plus a custom-size option. `unlockedLevel` locks higher levels (CPU mode). */
export function BoardPicker({
  value,
  onChange,
  unlockedLevel,
  allowCustom = true,
}: {
  value: BoardChoice;
  onChange(value: BoardChoice): void;
  unlockedLevel?: number;
  allowCustom?: boolean;
}) {
  const custom = value.level === CUSTOM_LEVEL;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Level">
        {LEVELS.map((l) => {
          const locked = unlockedLevel !== undefined && l.level > unlockedLevel;
          const selected = value.level === l.level;
          return (
            <button
              key={l.level}
              role="radio"
              aria-checked={selected}
              aria-label={`Level ${l.level}, ${l.rows} by ${l.columns} dots${locked ? ', locked' : ''}`}
              disabled={locked}
              onClick={() => onChange({ level: l.level, rows: l.rows, columns: l.columns })}
              className={cn(
                'flex flex-col items-center rounded-xl border-2 bg-card py-2 transition',
                selected ? 'border-primary bg-primary/10' : 'border-transparent',
                locked ? 'cursor-not-allowed opacity-45' : 'hover:border-primary/40',
              )}
            >
              <span className="text-lg font-bold">{locked ? <Lock className="my-1 size-4" /> : l.level}</span>
              <span className="text-[11px] text-muted-foreground">
                {l.rows}×{l.columns}
              </span>
            </button>
          );
        })}
      </div>
      {allowCustom && (
        <div className={cn('rounded-xl border-2 bg-card p-3', custom ? 'border-primary' : 'border-transparent')}>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="radio"
              checked={custom}
              onChange={() => onChange({ level: CUSTOM_LEVEL, rows: value.rows, columns: value.columns })}
              className="accent-[var(--primary)]"
            />
            Custom board
          </label>
          {custom && (
            <div className="mt-3 flex items-center justify-around gap-4">
              <Stepper label="Rows" value={value.rows} onChange={(rows) => onChange({ ...value, rows })} />
              <span className="text-muted-foreground">×</span>
              <Stepper label="Columns" value={value.columns} onChange={(columns) => onChange({ ...value, columns })} />
            </div>
          )}
          {custom && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {cellCount(value.rows, value.columns)} boxes · custom boards don&apos;t unlock levels
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground">{label} (dots)</span>
      <div className="flex items-center gap-2">
        <Button size="icon" variant="outline" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= MIN_DOTS} onClick={() => onChange(value - 1)}>
          <Minus />
        </Button>
        <span className="w-6 text-center text-lg font-bold tabular-nums" aria-live="polite">
          {value}
        </span>
        <Button size="icon" variant="outline" aria-label={`More ${label.toLowerCase()}`} disabled={value >= MAX_DOTS} onClick={() => onChange(value + 1)}>
          <Plus />
        </Button>
      </div>
    </div>
  );
}
