import { createRng } from '@dots/game-engine';
import type { MoveRecord, Rng } from '@dots/game-engine';
import { components, freeEdges, getTopology, greedyCaptureCount, play, safeMoves, undo } from './model';
import type { Position } from './model';
import { solveEndgame } from './search';

/** Player IDs a puzzle's moves are attributed to (match the CPU setup screen). */
export const PUZZLE_HUMAN_ID = 'human';
export const PUZZLE_CPU_ID = 'cpu-1';

/**
 * Search limits that let Hard play puzzle positions perfectly. Every generated
 * puzzle is checked to solve within them from its starting position.
 */
export const PUZZLE_SEARCH = { exactSearchMaxFreeEdges: 19, exactSearchNodeBudget: 600_000 };

export type PuzzleKind =
  /** No safe moves left: choose which chain to give away. */
  | 'open'
  /** The opponent just opened a chain: take it all, or double-deal to keep control. */
  | 'respond';

export interface Puzzle {
  no: number;
  kind: PuzzleKind;
  rows: number;
  columns: number;
  /** Player who makes `initialMoves[0]`; moves then alternate (none of them capture). */
  firstPlayerId: string;
  initialMoves: MoveRecord[];
  /** Boxes the human must finish with: the score of perfect play by both sides. */
  target: number;
  totalBoxes: number;
}

// Bigger boards leave too many free edges to solve exactly on a phone.
const SIZES: ReadonlyArray<readonly [number, number]> = [
  [4, 5],
  [5, 4],
  [5, 5],
];
const MAX_ATTEMPTS = 60;

function emptyPosition(rows: number, columns: number): Position {
  const topo = getTopology(rows, columns);
  return { topo, taken: new Uint8Array(topo.edgeCount), sides: new Uint8Array(topo.cellCount) };
}

/** Cells the opponent takes if we play `e`, greedily. */
function giveaway(pos: Position, e: number): number {
  play(pos, e);
  const { cells } = greedyCaptureCount(pos);
  undo(pos, e);
  return cells;
}

/** The move a reasonable but naive player makes: take everything, else give away the least. */
function naiveMove(pos: Position): number {
  const { moves } = greedyCaptureCount(pos);
  if (moves.length) return moves[0]!;
  const free = freeEdges(pos);
  return free.reduce((best, e) => (giveaway(pos, e) < giveaway(pos, best) ? e : best), free[0]!);
}

function attempt(no: number, rng: Rng): Puzzle | null {
  const [rows, columns] = rng.pick(SIZES);
  const pos = emptyPosition(rows, columns);
  const played: number[] = [];
  for (let safe = safeMoves(pos); safe.length; safe = safeMoves(pos)) {
    const e = rng.pick(safe);
    play(pos, e);
    played.push(e);
  }

  const kind: PuzzleKind = rng.next() < 0.5 ? 'open' : 'respond';
  if (kind === 'respond') {
    // The opponent opens the smallest chain, as a sensible player would.
    const free = freeEdges(pos);
    const min = Math.min(...free.map((e) => giveaway(pos, e)));
    const e = rng.pick(free.filter((f) => giveaway(pos, f) === min));
    play(pos, e);
    played.push(e);
  }

  // Control only matters with a long chain on the board.
  if (!components(pos).some((c) => c.cells.length >= 3)) return null;
  if (freeEdges(pos).length > PUZZLE_SEARCH.exactSearchMaxFreeEdges) return null;
  const solved = solveEndgame(pos, { extraTurn: true, nodeBudget: PUZZLE_SEARCH.exactSearchNodeBudget });
  // The human must be able to win, and the obvious move must not be good enough.
  if (!solved || solved.margin <= 0 || solved.bestMoves.includes(naiveMove(pos))) return null;

  const totalBoxes = pos.topo.cellCount;
  // Nobody has scored yet: every box is still on the board.
  const target = (totalBoxes + solved.margin) / 2;
  const humanMovesNext = played.length % 2 === 0;
  const firstPlayerId = humanMovesNext ? PUZZLE_HUMAN_ID : PUZZLE_CPU_ID;
  const secondPlayerId = humanMovesNext ? PUZZLE_CPU_ID : PUZZLE_HUMAN_ID;
  const initialMoves = played.map((e, i) => ({
    edgeId: pos.topo.edgeIds[e]!,
    playerId: i % 2 === 0 ? firstPlayerId : secondPlayerId,
  }));
  return { no, kind, rows, columns, firstPlayerId, initialMoves, target, totalBoxes };
}

/**
 * Deterministic puzzle for day `no`: the same everywhere, offline. Positions are
 * chain endgames from a random safe-move opening, verified with the exact solver.
 */
export function generateDailyPuzzle(no: number): Puzzle {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const puzzle = attempt(no, createRng(Math.imul(no + 1, 0x9e3779b1) ^ (i * 0x85ebca6b)));
    if (puzzle) return puzzle;
  }
  throw new Error(`No puzzle found for #${no}`);
}

/** Days since the first puzzle, in local time. */
export const PUZZLE_EPOCH = Date.UTC(2026, 9, 1);

export function puzzleNumber(date: Date): number {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((local - PUZZLE_EPOCH) / 86_400_000) + 1;
}
