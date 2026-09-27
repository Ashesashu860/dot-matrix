import type { GameState } from '@dots/game-engine';
import type { GameController, GameView } from './types';

export abstract class BaseController implements GameController {
  protected view: GameView;
  private listeners = new Set<() => void>();
  private eventCounter = 0;

  protected constructor(state: GameState, controllablePlayerIds: string[]) {
    this.view = {
      state,
      controllablePlayerIds,
      pendingEdgeId: null,
      lastEvent: null,
      paused: false,
      thinking: false,
      connection: 'connected',
      disconnectedPlayerIds: [],
      error: null,
    };
  }

  getView = (): GameView => this.view;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  protected nextEventId(): number {
    return ++this.eventCounter;
  }

  /** Replace the view immutably so useSyncExternalStore sees a new snapshot. */
  protected update(patch: Partial<GameView>): void {
    this.view = { ...this.view, ...patch };
    for (const listener of this.listeners) listener();
  }

  abstract submitMove(edgeId: string): void;

  pause(): void {
    this.update({ paused: true });
  }

  resume(): void {
    this.update({ paused: false });
  }

  dispose(): void {
    this.listeners.clear();
  }
}
