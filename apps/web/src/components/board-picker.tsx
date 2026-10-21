'use client';

import { CUSTOM_LEVEL, LEVELS, MIN_DOTS, SHAPES, cellCount, shapeCells, shapeSize } from '@dots/game-engine';
import type { ShapeDefinition } from '@dots/game-engine';
import { useEffect, useState } from 'react';
import { Chunky } from '@/components/kit';
import { useBoardLimits } from '@/lib/board-limits';
import { cn } from '@/lib/utils';

export interface BoardChoice {
  level: number;
  rows: number;
  columns: number;
  /** Shaped board from the catalog (level is CUSTOM_LEVEL). */
  shape?: string;
}

const tile = 'flex flex-col items-center justify-center gap-0.5 rounded-[18px] transition-all duration-150';

/** Level tiles, a custom-size option and shaped boards. */
export function BoardPicker({
  value,
  onChange,
  allowCustom = true,
  maxDots,
}: {
  value: BoardChoice;
  onChange(value: BoardChoice): void;
  allowCustom?: boolean;
  /** Tighter cap than the screen allows (online rooms). */
  maxDots?: number;
}) {
  const custom = value.level === CUSTOM_LEVEL && !value.shape;
  const screenLimits = useBoardLimits();
  const limits = maxDots
    ? { rows: Math.min(maxDots, screenLimits.rows), columns: Math.min(maxDots, screenLimits.columns) }
    : screenLimits;
  const shapes = Object.values(SHAPES).filter((sh: ShapeDefinition) => {
    const size = shapeSize(sh);
    return size.rows <= limits.rows && size.columns <= limits.columns;
  });
  const fit = (v: BoardChoice) => ({ ...v, rows: Math.min(v.rows, limits.rows), columns: Math.min(v.columns, limits.columns) });

  // Keep a custom size within the limits when the screen size changes.
  useEffect(() => {
    if (custom && (value.rows > limits.rows || value.columns > limits.columns)) onChange(fit(value));
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Level">
        {LEVELS.map((l) => {
          const selected = value.level === l.level;
          return (
            <Chunky
              key={l.level}
              role="radio"
              aria-checked={selected}
              aria-label={`Level ${l.level}, ${l.rows} by ${l.columns} dots`}
              tone={selected ? 'pink' : 'soft'}
              lift={4}
              onClick={() => onChange({ level: l.level, rows: l.rows, columns: l.columns })}
              className={cn(tile, 'h-[72px]')}
            >
              <span className="text-[26px] leading-none">{l.level}</span>
              <span className="font-sans text-[11px] font-extrabold">{`${l.rows}×${l.columns}`}</span>
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
            {cellCount(value.rows, value.columns)} boxes · up to {limits.rows}×{limits.columns}
            {maxDots ? '' : ' on this screen'}
          </p>
        </div>
      )}
      {shapes.length > 0 && (
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Shaped boards">
          {shapes.map((sh) => {
            const selected = value.shape === sh.id;
            const size = shapeSize(sh);
            const gold = [...shapeCells(sh).values()].filter((v) => v > 1).length;
            return (
              <Chunky
                key={sh.id}
                role="radio"
                aria-checked={selected}
                aria-label={`${sh.name} board${gold ? `, ${gold} gold boxes` : ''}`}
                tone={selected ? 'pink' : 'soft'}
                lift={4}
                onClick={() => onChange({ level: CUSTOM_LEVEL, ...size, shape: sh.id })}
                className={cn(tile, 'h-[84px] gap-1')}
              >
                <ShapePreview shape={sh} />
                <span className="font-sans text-[11px] font-extrabold">{sh.name}</span>
              </Chunky>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Tiny cell map of a shape: boxes, gold boxes and holes. */
function ShapePreview({ shape }: { shape: ShapeDefinition }) {
  const cell = 6;
  const width = shape.art[0]!.length * cell;
  const height = shape.art.length * cell;
  return (
    <svg aria-hidden="true" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {shape.art.flatMap((line, r) =>
        [...line].map((ch, c) =>
          ch === '.' ? null : (
            <rect
              key={`${r}-${c}`}
              x={c * cell + 0.5}
              y={r * cell + 0.5}
              width={cell - 1}
              height={cell - 1}
              rx={1.2}
              fill={ch === '$' ? '#FFB21E' : 'currentColor'}
              opacity={ch === '$' ? 1 : 0.55}
            />
          ),
        ),
      )}
    </svg>
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
