import { createRng, getValidMoves, isValidMove } from '@dots/game-engine';
import type { Edge, GameState, Rng } from '@dots/game-engine';
import {
  capturingMoves,
  completionCount,
  components,
  createsThirdSide,
  freeEdges,
  freeSidesOf,
  fromGameState,
  greedyCaptureCount,
  otherCell,
  play,
  safeMoves,
  undo,
} from './model';
import type { Component, Position } from './model';
import { solveEndgame } from './search';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Requirements §7.1. */
export interface CpuStrategy {
  readonly difficulty: Difficulty;
  chooseMove(gameState: GameState): Edge;
}

export interface StrategyOptions {
  seed?: number;
  /** Max free edges for the exact endgame solver (Hard, 2 players). */
  exactSearchMaxFreeEdges?: number;
  exactSearchNodeBudget?: number;
}

type Picker = (pos: Position, state: GameState, rng: Rng) => number;

const EASY_CAPTURE_CHANCE = 0.75;
const EASY_SAFE_CHANCE = 0.7;

/** Prefer captures that complete two cells at once. */
function bestCapture(pos: Position, captures: number[], rng: Rng): number {
  const doubles = captures.filter((e) => completionCount(pos, e) === 2);
  return rng.pick(doubles.length ? doubles : captures);
}

/** How many cells the opponent can take after we play `e`. */
function sacrificeSize(pos: Position, e: number): number {
  play(pos, e);
  const { cells } = greedyCaptureCount(pos);
  undo(pos, e);
  return cells;
}

function threeSidedCreated(pos: Position, e: number): number {
  let n = 0;
  for (let i = 0; i < 2; i++) {
    const cell = pos.topo.edgeCells[e * 2 + i]!;
    if (cell >= 0 && pos.sides[cell] === 2) n++;
  }
  return n;
}

/**
 * Pick the move that gives away the fewest cells. With `hardHearted`, ties are
 * broken towards moves that create two separate 3-sided cells, which denies the
 * opponent a double-dealing reply.
 */
function smallestSacrifice(pos: Position, rng: Rng, hardHearted: boolean): number {
  const scored = freeEdges(pos).map((e) => ({
    e,
    cost: sacrificeSize(pos, e),
    split: hardHearted ? threeSidedCreated(pos, e) : 0,
  }));
  const minCost = Math.min(...scored.map((s) => s.cost));
  let best = scored.filter((s) => s.cost === minCost);
  const maxSplit = Math.max(...best.map((s) => s.split));
  best = best.filter((s) => s.split === maxSplit);
  return rng.pick(best).e;
}

const easy: Picker = (pos, _state, rng) => {
  const captures = capturingMoves(pos);
  if (captures.length && rng.next() < EASY_CAPTURE_CHANCE) return rng.pick(captures);
  const safe = safeMoves(pos);
  if (safe.length && rng.next() < EASY_SAFE_CHANCE) return rng.pick(safe);
  return rng.pick(freeEdges(pos));
};

const medium: Picker = (pos, _state, rng) => {
  const captures = capturingMoves(pos);
  if (captures.length) return bestCapture(pos, captures, rng);
  const safe = safeMoves(pos);
  if (safe.length) {
    // Prefer edges touching fewer claimed sides: keeps the board open longer.
    const weight = (e: number) => {
      let w = 0;
      for (let i = 0; i < 2; i++) {
        const cell = pos.topo.edgeCells[e * 2 + i]!;
        if (cell >= 0) w += pos.sides[cell]!;
      }
      return w;
    };
    const min = Math.min(...safe.map(weight));
    return rng.pick(safe.filter((e) => weight(e) === min));
  }
  return smallestSacrifice(pos, rng, false);
};

/**
 * Cells the player in control must concede to keep control through the rest of
 * the endgame: 2 per long chain and 4 per loop, short chains conceded in full,
 * except the final component which the controller takes whole.
 */
function controlCost(comps: Component[]): { total: number; sacrifices: number } {
  let total = 0;
  const costs: number[] = [];
  for (const comp of comps) {
    const size = comp.cells.length;
    total += size;
    if (comp.isLoop) costs.push(Math.min(4, size));
    else costs.push(size >= 3 ? 2 : size);
  }
  if (costs.length === 0) return { total, sacrifices: 0 };
  // The controller keeps the largest component whole at the end.
  const largestIndex = comps.reduce(
    (best, c, i) => (c.cells.length > comps[best]!.cells.length ? i : best),
    0,
  );
  const sacrifices = costs.reduce((s, c, i) => (i === largestIndex ? s : s + c), 0);
  return { total, sacrifices };
}

/**
 * When the last two capturable cells form the end of a chain, returns the
 * "double-dealing" edge that hands both to the opponent so we keep control.
 */
function doubleDealingMove(pos: Position): number | null {
  const threeSided: number[] = [];
  for (let cell = 0; cell < pos.topo.cellCount; cell++) {
    if (pos.sides[cell] === 3) threeSided.push(cell);
  }
  if (threeSided.length !== 1) return null;
  const a = threeSided[0]!;
  const shared = freeSidesOf(pos, a)[0]!;
  const b = otherCell(pos.topo, shared, a);
  if (b < 0 || pos.sides[b] !== 2) return null;
  const outer = freeSidesOf(pos, b).filter((e) => e !== shared);
  if (outer.length !== 1) return null;
  const e = outer[0]!;
  const beyond = otherCell(pos.topo, e, b);
  // Claiming the outer edge must not open a third cell.
  if (beyond >= 0 && pos.sides[beyond]! >= 2) return null;
  return e;
}

function hardPicker(options: Required<Omit<StrategyOptions, 'seed'>>): Picker {
  return (pos, state, rng) => {
    const twoPlayer = state.players.filter((p) => p.active).length === 2;
    const free = freeEdges(pos);

    if (twoPlayer && free.length <= options.exactSearchMaxFreeEdges) {
      const solved = solveEndgame(pos, {
        extraTurn: state.config.extraTurnOnCapture,
        nodeBudget: options.exactSearchNodeBudget,
      });
      if (solved) return rng.pick(solved.bestMoves);
    }

    const captures = capturingMoves(pos);
    if (captures.length) {
      if (twoPlayer && state.config.extraTurnOnCapture) {
        const greedy = greedyCaptureCount(pos);
        if (greedy.cells === 2) {
          for (const e of greedy.moves) play(pos, e);
          const safeAfter = safeMoves(pos).length;
          const { total, sacrifices } = controlCost(components(pos));
          for (let i = greedy.moves.length - 1; i >= 0; i--) undo(pos, greedy.moves[i]!);
          // Keeping control is worth it when the controller nets more than the
          // two cells conceded now (see long-chain rule).
          if (safeAfter === 0 && total - 2 * sacrifices > 2) {
            const dd = doubleDealingMove(pos);
            if (dd !== null) return dd;
          }
        }
      }
      return bestCapture(pos, captures, rng);
    }

    const safe = safeMoves(pos);
    if (safe.length) {
      if (!twoPlayer) return rng.pick(safe);
      // Parity heuristic: leave the opponent an even number of safe moves so
      // they run out first and must open the first chain.
      const scored = safe.map((e) => {
        play(pos, e);
        const remaining = safeMoves(pos).length;
        undo(pos, e);
        return { e, remaining };
      });
      const even = scored.filter((s) => s.remaining % 2 === 0);
      return rng.pick(even.length ? even : scored).e;
    }

    return smallestSacrifice(pos, rng, true);
  };
}

const DEFAULTS = { exactSearchMaxFreeEdges: 16, exactSearchNodeBudget: 250_000 };

export function createCpuStrategy(
  difficulty: Difficulty,
  options: StrategyOptions = {},
): CpuStrategy {
  const rng = createRng(options.seed ?? 0x5eed);
  const picker: Picker =
    difficulty === 'easy'
      ? easy
      : difficulty === 'medium'
        ? medium
        : hardPicker({ ...DEFAULTS, ...stripUndefined(options) });

  return {
    difficulty,
    chooseMove(state) {
      if (state.status !== 'playing') throw new Error('Game is not in progress');
      const pos = fromGameState(state);
      if (freeEdges(pos).length === 0) throw new Error('No valid moves');
      const id = pos.topo.edgeIds[picker(pos, state, rng)];
      // Safety net (§7.3): only ever return an edge the engine accepts.
      if (id !== undefined && isValidMove(state, id)) return state.edges[id]!;
      const fallback = getValidMoves(state)[0];
      if (!fallback) throw new Error('No valid moves');
      return fallback;
    },
  };
}

function stripUndefined(options: StrategyOptions) {
  const out: Partial<typeof DEFAULTS> = {};
  if (options.exactSearchMaxFreeEdges !== undefined) {
    out.exactSearchMaxFreeEdges = options.exactSearchMaxFreeEdges;
  }
  if (options.exactSearchNodeBudget !== undefined) {
    out.exactSearchNodeBudget = options.exactSearchNodeBudget;
  }
  return out;
}

// Exposed for tests.
export const __internal = { createsThirdSide, doubleDealingMove, controlCost };
