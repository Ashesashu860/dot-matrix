import { PUZZLE_CPU_ID, PUZZLE_HUMAN_ID, PUZZLE_SEARCH } from '@dots/cpu-engine';
import { CUSTOM_LEVEL } from '@dots/game-engine';
import type { GameState, MoveRecord } from '@dots/game-engine';
import { PLAYER_COLORS } from '@dots/protocol';
import type { LocalGameSetup } from '@/controllers/local-controller';

/** The bot that plays puzzles and lessons, perfectly. */
export const PUZZLE_BOT = 'Nova';

/** A position to play out against a perfect bot (daily puzzles, lessons). */
export interface PuzzlePosition {
  rows: number;
  columns: number;
  firstPlayerId: string;
  initialMoves: MoveRecord[];
}

export function puzzleSetup(position: PuzzlePosition, seed: number): LocalGameSetup {
  return {
    create: {
      mode: 'cpu',
      level: CUSTOM_LEVEL,
      rows: position.rows,
      columns: position.columns,
      players: [
        { id: PUZZLE_HUMAN_ID, name: 'You', type: 'human', color: PLAYER_COLORS[0] },
        { id: PUZZLE_CPU_ID, name: PUZZLE_BOT, type: 'cpu', color: PLAYER_COLORS[1] },
      ],
      config: { extraTurnOnCapture: true },
    },
    difficulty: 'hard',
    seed,
    initialMoves: position.initialMoves,
    firstPlayerId: position.firstPlayerId,
    cpuOptions: PUZZLE_SEARCH,
  };
}

/** Lines already drawn, attributed alternately so the human moves next. */
export function positionFromEdges(rows: number, columns: number, edges: readonly string[]): PuzzlePosition {
  const humanFirst = edges.length % 2 === 0;
  const [a, b] = humanFirst ? [PUZZLE_HUMAN_ID, PUZZLE_CPU_ID] : [PUZZLE_CPU_ID, PUZZLE_HUMAN_ID];
  return {
    rows,
    columns,
    firstPlayerId: a,
    initialMoves: edges.map((edgeId, i) => ({ edgeId, playerId: i % 2 === 0 ? a : b })),
  };
}

export const humanScore = (state: GameState) => state.players.find((p) => p.id === PUZZLE_HUMAN_ID)?.score ?? 0;
