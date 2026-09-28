import { edgeId, parseEdgeId } from '@dots/game-engine';

/** SVG units between adjacent dots. */
export const SPACING = 100;
/** SVG units around the outer dots. */
export const PADDING = 22;

export interface Point {
  x: number;
  y: number;
}

export interface BoardSize {
  rows: number;
  columns: number;
}

export function viewBoxSize({ rows, columns }: BoardSize) {
  return {
    width: (columns - 1) * SPACING + PADDING * 2,
    height: (rows - 1) * SPACING + PADDING * 2,
  };
}

export function dotPosition(row: number, column: number): Point {
  return { x: PADDING + column * SPACING, y: PADDING + row * SPACING };
}

export function edgeSegment(id: string, size: BoardSize): [Point, Point] | null {
  const parsed = parseEdgeId(id, size.rows, size.columns);
  if (!parsed) return null;
  const start = dotPosition(parsed.row, parsed.column);
  const end =
    parsed.orientation === 'horizontal'
      ? dotPosition(parsed.row, parsed.column + 1)
      : dotPosition(parsed.row + 1, parsed.column);
  return [start, end];
}

export function edgeMidpoint(id: string, size: BoardSize): Point | null {
  const seg = edgeSegment(id, size);
  if (!seg) return null;
  return { x: (seg[0].x + seg[1].x) / 2, y: (seg[0].y + seg[1].y) / 2 };
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * The available edge closest to `point` (in SVG units), or null if none is within
 * `tolerance` × spacing. Only edges near the point are examined, so this stays
 * cheap on large boards. Generous tolerance means taps need not be pixel-perfect.
 */
export function nearestEdge(
  point: Point,
  size: BoardSize,
  isAvailable: (id: string) => boolean,
  tolerance = 0.45,
): string | null {
  const gx = (point.x - PADDING) / SPACING;
  const gy = (point.y - PADDING) / SPACING;
  const r0 = Math.floor(gy);
  const c0 = Math.floor(gx);
  let best: string | null = null;
  let bestDistance = tolerance * SPACING;
  for (let r = r0 - 1; r <= r0 + 2; r++) {
    for (let c = c0 - 1; c <= c0 + 2; c++) {
      for (const orientation of ['horizontal', 'vertical'] as const) {
        const id = edgeId(orientation, r, c);
        const seg = edgeSegment(id, size);
        if (!seg || !isAvailable(id)) continue;
        const d = distanceToSegment(point, seg[0], seg[1]);
        if (d <= bestDistance) {
          bestDistance = d;
          best = id;
        }
      }
    }
  }
  return best;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Keyboard navigation: from `fromId`, the closest candidate edge whose midpoint
 * lies in `direction`. Off-axis distance is penalised so arrows feel like a grid.
 */
export function edgeInDirection(
  fromId: string,
  direction: Direction,
  size: BoardSize,
  candidates: readonly string[],
): string | null {
  const from = edgeMidpoint(fromId, size);
  if (!from) return candidates[0] ?? null;
  let best: string | null = null;
  let bestScore = Infinity;
  for (const id of candidates) {
    if (id === fromId) continue;
    const to = edgeMidpoint(id, size);
    if (!to) continue;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const along = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy;
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 0) continue;
    const score = along + across * 2;
    if (score < bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

/** Human-readable description of an edge for screen readers (1-based). */
export function describeEdge(id: string, size: BoardSize): string {
  const parsed = parseEdgeId(id, size.rows, size.columns);
  if (!parsed) return id;
  const row = parsed.row + 1;
  const column = parsed.column + 1;
  return parsed.orientation === 'horizontal'
    ? `Horizontal line in row ${row}, between columns ${column} and ${column + 1}`
    : `Vertical line in column ${column}, between rows ${row} and ${row + 1}`;
}
