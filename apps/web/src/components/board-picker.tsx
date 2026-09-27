'use client';

import { CUSTOM_LEVEL, LEVELS, MAX_DOTS, MIN_DOTS, cellCount } from '@dots/game-engine';
import { Chunky } from '@/components/kit';
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
}: {
  value: BoardChoice;
  onChange(value: BoardChoice): void;
  unlockedLevel?: number;
  allowCustom?: boolean;
}) {
  const sound = useSettings((s) => s.sound);
  const custom = value.level === CUSTOM_LEVEL;
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
            onClick={() => onChange({ level: CUSTOM_LEVEL, rows: value.rows, columns: value.columns })}
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
          <div className="flex items-center justify-around gap-4">
            <Stepper label="Rows" value={value.rows} onChange={(rows) => onChange({ ...value, rows })} />
            <span className="font-display text-xl text-label">×</span>
            <Stepper label="Columns" value={value.columns} onChange={(columns) => onChange({ ...value, columns })} />
          </div>
          <p className="text-center text-xs font-bold text-label">
            {cellCount(value.rows, value.columns)} boxes · custom boards don&apos;t unlock levels
          </p>
        </div>
      )}
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange(v: number): void }) {
  const step = 'flex size-[42px] items-center justify-center rounded-[14px] text-2xl leading-none';
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="card-label text-[10px]!">{label} (dots)</span>
      <div className="flex items-center gap-2">
        <Chunky tone="white" lift={3} className={step} aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= MIN_DOTS} onClick={() => onChange(value - 1)}>
          −
        </Chunky>
        <span className="w-6 text-center font-display text-xl font-extrabold text-ink tabular-nums" aria-live="polite">
          {value}
        </span>
        <Chunky tone="white" lift={3} className={step} aria-label={`More ${label.toLowerCase()}`} disabled={value >= MAX_DOTS} onClick={() => onChange(value + 1)}>
          +
        </Chunky>
      </div>
    </div>
  );
}
