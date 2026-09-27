import { freeEdges, play, undo } from './model';
import type { Position } from './model';

export interface ExactSearchOptions {
  /** Whether completing a cell keeps the turn (GameConfig.extraTurnOnCapture). */
  extraTurn: boolean;
  /** Abort (return null) after this many visited nodes. */
  nodeBudget: number;
}

class BudgetExceeded extends Error {}

/**
 * Exact 2-player endgame solver: memoised negamax over the remaining free edges.
 * Returns the best edges for the player to move and the resulting score margin,
 * or null if the free-edge count is too large or the node budget runs out.
 */
export function solveEndgame(
  pos: Position,
  options: ExactSearchOptions,
): { bestMoves: number[]; margin: number } | null {
  const free = freeEdges(pos);
  if (free.length === 0 || free.length > 30) return null;
  const full = free.length === 30 ? 0x3fffffff : (1 << free.length) - 1;
  const memo = new Map<number, number>();
  let nodes = 0;

  const negamax = (mask: number): number => {
    if (mask === full) return 0;
    const cached = memo.get(mask);
    if (cached !== undefined) return cached;
    if (++nodes > options.nodeBudget) throw new BudgetExceeded();
    let best = -Infinity;
    for (let i = 0; i < free.length; i++) {
      const bit = 1 << i;
      if (mask & bit) continue;
      const e = free[i]!;
      const gained = play(pos, e);
      const value =
        gained > 0 && options.extraTurn
          ? gained + negamax(mask | bit)
          : gained - negamax(mask | bit);
      undo(pos, e);
      if (value > best) best = value;
    }
    memo.set(mask, best);
    return best;
  };

  try {
    let margin = -Infinity;
    let bestMoves: number[] = [];
    for (let i = 0; i < free.length; i++) {
      const bit = 1 << i;
      const e = free[i]!;
      const gained = play(pos, e);
      const value =
        gained > 0 && options.extraTurn ? gained + negamax(bit) : gained - negamax(bit);
      undo(pos, e);
      if (value > margin) {
        margin = value;
        bestMoves = [e];
      } else if (value === margin) {
        bestMoves.push(e);
      }
    }
    return { bestMoves, margin };
  } catch (error) {
    if (error instanceof BudgetExceeded) {
      // Restore any edges left claimed when the search unwound mid-move.
      for (const e of free) if (pos.taken[e]) undo(pos, e);
      return null;
    }
    throw error;
  }
}
