import { applyMove, createGame } from '@dots/game-engine';
import type { CreateGameOptions, GameState } from '@dots/game-engine';
import type { Difficulty } from '@dots/cpu-engine';
import { BaseController } from './base-controller';

/** What is needed to recreate a local/CPU game (saved with it in IndexedDB). */
export interface LocalGameSetup {
  create: Omit<CreateGameOptions, 'gameId' | 'startedAt'>;
  difficulty?: Difficulty;
  seed: number;
  /** vs CPU: the first bot opens instead of the human (kept for rematches). */
  cpuFirst?: boolean;
}

export interface LocalControllerHooks {
  /** Called after every accepted move (persist the game). */
  onChange?(state: GameState, setup: LocalGameSetup): void;
  /** Called once when the game ends (record history/stats). */
  onFinished?(state: GameState, setup: LocalGameSetup): void;
  now?(): number;
  newGameId?(): string;
}

export function newLocalGame(setup: LocalGameSetup, gameId: string, now: number): GameState {
  const state = createGame({ ...setup.create, gameId, startedAt: now });
  const firstCpu = state.players.findIndex((p) => p.type === 'cpu');
  return setup.cpuFirst && firstCpu >= 0 ? { ...state, currentPlayerIndex: firstCpu } : state;
}

/** Local multiplayer: the in-browser engine is the authority. */
export class LocalController extends BaseController {
  protected readonly hooks: LocalControllerHooks;
  readonly setup: LocalGameSetup;

  constructor(state: GameState, setup: LocalGameSetup, hooks: LocalControllerHooks = {}) {
    const humans = state.players.filter((p) => p.type === 'human').map((p) => p.id);
    super(state, humans);
    this.setup = setup;
    this.hooks = hooks;
  }

  protected now(): number {
    return this.hooks.now?.() ?? Date.now();
  }

  submitMove(edgeId: string): void {
    const current = this.view.state.players[this.view.state.currentPlayerIndex];
    if (!current || this.view.paused || !this.view.controllablePlayerIds.includes(current.id)) {
      return;
    }
    this.apply(edgeId, current.id);
  }

  /** Apply a move for `playerId` through the engine. Returns false if rejected. */
  protected apply(edgeId: string, playerId: string): boolean {
    const result = applyMove(this.view.state, edgeId, playerId, { now: this.now() });
    if (!result.ok) {
      this.update({ error: result.error });
      return false;
    }
    this.update({
      state: result.gameState,
      error: null,
      lastEvent: {
        id: this.nextEventId(),
        edgeId,
        playerId,
        completedCells: result.completedCells,
        extraTurn: result.extraTurn,
        gameOver: result.gameOver,
      },
    });
    this.hooks.onChange?.(result.gameState, this.setup);
    if (result.gameOver) this.hooks.onFinished?.(result.gameState, this.setup);
    this.afterMove();
    return true;
  }

  /** Hook for subclasses (CPU scheduling). */
  protected afterMove(): void {}

  restart(): void {
    const gameId = this.hooks.newGameId?.() ?? crypto.randomUUID();
    const state = newLocalGame(this.setup, gameId, this.now());
    this.update({ state, lastEvent: null, paused: false, error: null });
    this.hooks.onChange?.(state, this.setup);
    this.afterMove();
  }
}
