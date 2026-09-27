import type { GameState } from '@dots/game-engine';

export interface MoveEvent {
  /** Monotonic, so UI effects can key on it. */
  id: number;
  edgeId: string;
  playerId: string;
  completedCells: string[];
  extraTurn: boolean;
  gameOver: boolean;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline';

export interface GameView {
  state: GameState;
  /** Players this device may move for (all humans locally; just "me" online). */
  controllablePlayerIds: string[];
  /** Edge submitted but not yet confirmed (online). */
  pendingEdgeId: string | null;
  lastEvent: MoveEvent | null;
  paused: boolean;
  /** A CPU is choosing its move. */
  thinking: boolean;
  connection: ConnectionStatus;
  /** Players currently disconnected (online). */
  disconnectedPlayerIds: string[];
  error: string | null;
}

/**
 * Everything the game screen needs, independent of where authority lives
 * (browser engine for local/CPU, Cloud Functions for online).
 */
export interface GameController {
  getView(): GameView;
  subscribe(listener: () => void): () => void;
  submitMove(edgeId: string): void;
  pause(): void;
  resume(): void;
  /** Local/CPU only: start over with the same setup. */
  restart?(): void;
  dispose(): void;
}

export function canInteract(view: GameView): boolean {
  const current = view.state.players[view.state.currentPlayerIndex];
  return (
    view.state.status === 'playing' &&
    !view.paused &&
    !view.thinking &&
    view.pendingEdgeId === null &&
    current !== undefined &&
    view.controllablePlayerIds.includes(current.id)
  );
}
