/**
 * Smallest and largest supported dot grids (per side). This is the hard cap;
 * the web app applies tighter limits for custom boards on small screens.
 */
export const MIN_DOTS = 3;
export const MAX_DOTS = 50;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export interface LevelDefinition {
  level: number;
  /** Dot rows. */
  rows: number;
  /** Dot columns. */
  columns: number;
}

/**
 * Progressive levels from the requirements (§2.1). Past 8×8 the boards grow
 * taller rather than wider: phones are portrait, so extra rows cost far less
 * tap-target size than extra columns.
 */
export const LEVELS: readonly LevelDefinition[] = [
  { level: 1, rows: 4, columns: 4 },
  { level: 2, rows: 5, columns: 5 },
  { level: 3, rows: 6, columns: 6 },
  { level: 4, rows: 7, columns: 7 },
  { level: 5, rows: 8, columns: 8 },
  { level: 6, rows: 9, columns: 8 },
  { level: 7, rows: 10, columns: 8 },
  { level: 8, rows: 11, columns: 9 },
];

export const MAX_LEVEL = LEVELS.length;

/** Level number used for custom-sized boards. */
export const CUSTOM_LEVEL = 0;

export function getLevel(level: number): LevelDefinition | undefined {
  return LEVELS.find((l) => l.level === level);
}

export function isValidBoardSize(rows: number, columns: number): boolean {
  return (
    Number.isInteger(rows) &&
    Number.isInteger(columns) &&
    rows >= MIN_DOTS &&
    rows <= MAX_DOTS &&
    columns >= MIN_DOTS &&
    columns <= MAX_DOTS
  );
}

export function customBoard(rows: number, columns: number): LevelDefinition {
  if (!isValidBoardSize(rows, columns)) {
    throw new RangeError(
      `Board must be between ${MIN_DOTS} and ${MAX_DOTS} dots per side, got ${rows}x${columns}`,
    );
  }
  return { level: CUSTOM_LEVEL, rows, columns };
}

export function cellCount(rows: number, columns: number): number {
  return (rows - 1) * (columns - 1);
}

export function edgeCount(rows: number, columns: number): number {
  return rows * (columns - 1) + (rows - 1) * columns;
}
