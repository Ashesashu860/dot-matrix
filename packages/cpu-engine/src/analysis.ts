import { applyMove } from '@dots/game-engine';
import type { GameState, MoveRecord } from '@dots/game-engine';
import { freeEdges, fromGameState, play, undo } from './model';
import { solveEndgame } from './search';

export interface TurningPoint {
  /** Index into the analysed moves of the costly move. */
  moveIndex: number;
  /** Position just before it. */
  state: GameState;
  played: string;
  better: string;
  /** Boxes the move cost against perfect play from both sides. */
  boxes: number;
}

export interface AnalysisOptions {
  /** Only positions this small are solved exactly. */
  maxFreeEdges?: number;
  nodeBudget?: number;
}

/**
 * Replay a two-player game and find `playerId`'s most expensive move among the
 * positions small enough to solve exactly (the endgame, where games are won or
 * lost). Returns null when every solvable move was perfect.
 */
export function findTurningPoint(
  initial: GameState,
  moves: readonly MoveRecord[],
  playerId: string,
  { maxFreeEdges = 18, nodeBudget = 600_000 }: AnalysisOptions = {},
): TurningPoint | null {
  if (initial.players.length !== 2) return null;
  const extraTurn = initial.config.extraTurnOnCapture;
  let state = initial;
  let worst: TurningPoint | null = null;
  let worstCost = 0;

  moves.forEach((move, moveIndex) => {
    if (move.playerId === playerId) {
      const pos = fromGameState(state);
      const played = pos.topo.edgeIndex.get(move.edgeId);
      if (played !== undefined && freeEdges(pos).length <= maxFreeEdges) {
        const best = solveEndgame(pos, { extraTurn, nodeBudget });
        const gained = play(pos, played);
        const after = freeEdges(pos).length ? solveEndgame(pos, { extraTurn, nodeBudget }) : { margin: 0 };
        undo(pos, played);
        if (best && after) {
          const value = gained > 0 && extraTurn ? gained + after.margin : gained - after.margin;
          // Margins count both sides, so one box handed over costs 2.
          const cost = best.margin - value;
          if (cost > worstCost) {
            worstCost = cost;
            worst = {
              moveIndex,
              state,
              played: move.edgeId,
              better: pos.topo.edgeIds[best.bestMoves[0]!]!,
              boxes: cost / 2,
            };
          }
        }
      }
    }
    const result = applyMove(state, move.edgeId, move.playerId);
    if (!result.ok) throw new Error(`Move ${moveIndex} (${move.edgeId}) rejected: ${result.error}`);
    state = result.gameState;
  });
  return worst;
}
