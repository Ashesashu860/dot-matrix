import type { Orientation } from './types';

export interface DotPosition {
  row: number;
  column: number;
}

export interface ParsedEdgeId {
  orientation: Orientation;
  row: number;
  column: number;
}

const EDGE_ID_PATTERN = /^([HV])-(\d{1,3})-(\d{1,3})$/;

export function edgeId(orientation: Orientation, row: number, column: number): string {
  return `${orientation === 'horizontal' ? 'H' : 'V'}-${row}-${column}`;
}

export function cellId(row: number, column: number): string {
  return `C-${row}-${column}`;
}

/**
 * Parse an edge ID and check it fits a board of `rows` x `columns` dots.
 * Returns null for malformed or out-of-range IDs.
 */
export function parseEdgeId(id: string, rows: number, columns: number): ParsedEdgeId | null {
  if (typeof id !== 'string') return null;
  const match = EDGE_ID_PATTERN.exec(id);
  if (!match) return null;
  const orientation: Orientation = match[1] === 'H' ? 'horizontal' : 'vertical';
  const row = Number(match[2]);
  const column = Number(match[3]);
  // Reject leading zeros so every edge has exactly one canonical ID.
  if (edgeId(orientation, row, column) !== id) return null;
  const maxRow = orientation === 'horizontal' ? rows - 1 : rows - 2;
  const maxColumn = orientation === 'horizontal' ? columns - 2 : columns - 1;
  if (row < 0 || row > maxRow || column < 0 || column > maxColumn) return null;
  return { orientation, row, column };
}

/**
 * Edge ID connecting two dots, or null when the dots are not orthogonally adjacent
 * (diagonal, skipping a dot, identical, or off the board).
 */
export function edgeIdBetweenDots(
  a: DotPosition,
  b: DotPosition,
  rows: number,
  columns: number,
): string | null {
  const inBounds = (d: DotPosition) =>
    Number.isInteger(d.row) &&
    Number.isInteger(d.column) &&
    d.row >= 0 &&
    d.row < rows &&
    d.column >= 0 &&
    d.column < columns;
  if (!inBounds(a) || !inBounds(b)) return null;
  const dRow = Math.abs(a.row - b.row);
  const dColumn = Math.abs(a.column - b.column);
  if (dRow === 0 && dColumn === 1) {
    return edgeId('horizontal', a.row, Math.min(a.column, b.column));
  }
  if (dRow === 1 && dColumn === 0) {
    return edgeId('vertical', Math.min(a.row, b.row), a.column);
  }
  return null;
}

/** The two dots an edge connects. */
export function edgeEndpoints(edge: ParsedEdgeId): [DotPosition, DotPosition] {
  const start = { row: edge.row, column: edge.column };
  const end =
    edge.orientation === 'horizontal'
      ? { row: edge.row, column: edge.column + 1 }
      : { row: edge.row + 1, column: edge.column };
  return [start, end];
}

/** IDs of the one or two cells bordering an edge. */
export function cellsAdjacentToEdge(edge: ParsedEdgeId, rows: number, columns: number): string[] {
  const cellRows = rows - 1;
  const cellColumns = columns - 1;
  const candidates: Array<[number, number]> =
    edge.orientation === 'horizontal'
      ? [
          [edge.row - 1, edge.column],
          [edge.row, edge.column],
        ]
      : [
          [edge.row, edge.column - 1],
          [edge.row, edge.column],
        ];
  return candidates
    .filter(([r, c]) => r >= 0 && r < cellRows && c >= 0 && c < cellColumns)
    .map(([r, c]) => cellId(r, c));
}
