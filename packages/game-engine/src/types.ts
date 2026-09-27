/**
 * Core domain types for Dots Matrix.
 *
 * Every type here is plain JSON (no Maps, classes or Dates) so a GameState can be
 * stored as-is in Firestore or IndexedDB and posted to a Web Worker.
 */

export type PlayerType = 'human' | 'cpu';

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  color: string;
  score: number;
  /** False once a player has forfeited or timed out; inactive players are skipped. */
  active: boolean;
}

export type Orientation = 'horizontal' | 'vertical';

export interface Edge {
  /** Deterministic ID: `H-{row}-{column}` or `V-{row}-{column}`. */
  id: string;
  orientation: Orientation;
  /** Row/column of the edge's first (top/left) dot. */
  row: number;
  column: number;
  claimedBy?: string;
}

export interface Cell {
  /** Deterministic ID: `C-{row}-{column}`. */
  id: string;
  row: number;
  column: number;
  top: string;
  right: string;
  bottom: string;
  left: string;
  ownerId?: string;
}

export type GameMode = 'cpu' | 'local' | 'online';
export type GameStatus = 'waiting' | 'playing' | 'finished';

export interface GameConfig {
  /** Completing one or more cells grants the same player another move. */
  extraTurnOnCapture: boolean;
}

export interface LastMove {
  edgeId: string;
  playerId: string;
  completedCells: string[];
}

export interface GameState {
  gameId: string;
  mode: GameMode;
  level: number;
  /** Number of dot rows. */
  rows: number;
  /** Number of dot columns. */
  columns: number;
  players: Player[];
  edges: Record<string, Edge>;
  cells: Record<string, Cell>;
  currentPlayerIndex: number;
  status: GameStatus;
  totalMoves: number;
  startedAt?: number;
  endedAt?: number;
  config: GameConfig;
  winnerIds?: string[];
  isDraw?: boolean;
  lastMove?: LastMove;
}

export type MoveError =
  | 'GAME_NOT_PLAYING'
  | 'UNKNOWN_PLAYER'
  | 'NOT_YOUR_TURN'
  | 'INVALID_EDGE'
  | 'EDGE_ALREADY_USED';

export interface MoveSuccess {
  ok: true;
  gameState: GameState;
  completedCells: string[];
  scoreGained: number;
  extraTurn: boolean;
  gameOver: boolean;
}

export interface MoveFailure {
  ok: false;
  error: MoveError;
}

export type MoveResult = MoveSuccess | MoveFailure;

export interface WinnerResult {
  winnerIds: string[];
  isDraw: boolean;
}

export interface MoveRecord {
  edgeId: string;
  playerId: string;
}
