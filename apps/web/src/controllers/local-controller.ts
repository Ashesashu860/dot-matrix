import { applyMove, createGame, replay } from '@dots/game-engine';
import type { CreateGameOptions, GameState, MoveRecord } from '@dots/game-engine';
import type { Difficulty } from '@dots/cpu-engine';
import type { BotOptions } from '@/workers/cpu-protocol';
import { BaseController } from './base-controller';

/** What is needed to recreate a local/CPU game (saved with it in IndexedDB). */
export interface LocalGameSetup {
  create: Omit<CreateGameOptions, 'gameId' | 'startedAt'>;
  difficulty?: Difficulty;
  seed: number;
  /** vs CPU: the first bot opens instead of the human (kept for rematches). */
  cpuFirst?: boolean;
  /** Start from a position: these moves are replayed, beginning with `firstPlayerId`. */
  initialMoves?: MoveRecord[];
  firstPlayerId?: string;
  /** Strategy tuning for every bot (puzzles raise search limits so the bot plays perfectly). */
  cpuOptions?: BotOptions;
  /** Per-bot difficulty and tuning, by player ID; overrides `difficulty`/`cpuOptions`. */
  bots?: Record<string, { difficulty: Difficulty; options?: BotOptions }>;
  /** Campaign stage this game plays (see lib/campaign). */
  campaignStage?: string;
}

/** A move as played in this game (moves replayed from a starting position excluded). */
export interface LoggedMove {
  edgeId: string;
  playerId: string;
  /** Boxes the move completed. */
  cells: number;
}

export interface LocalControllerHooks {
  /** Called after every accepted move (persist the game). */
  onChange?(state: GameState, setup: LocalGameSetup, log: readonly LoggedMove[]): void;
  /** Called once when the game ends (record history/stats). */
  onFinished?(state: GameState, setup: LocalGameSetup, log: readonly LoggedMove[]): void;
  now?(): number;
  newGameId?(): string;
}

export function newLocalGame(setup: LocalGameSetup, gameId: string, now: number): GameState {
  const state = createGame({ ...setup.create, gameId, startedAt: now });
  const first = setup.firstPlayerId
    ? state.players.findIndex((p) => p.id === setup.firstPlayerId)
    : setup.cpuFirst
      ? state.players.findIndex((p) => p.type === 'cpu')
      : -1;
  const start = first >= 0 ? { ...state, currentPlayerIndex: first } : state;
  return setup.initialMoves?.length ? replay(start, setup.initialMoves) : start;
}

/** Local multiplayer: the in-browser engine is the authority. */
export class LocalController extends BaseController {
  protected readonly hooks: LocalControllerHooks;
  readonly setup: LocalGameSetup;
  private log: LoggedMove[];

  constructor(
    state: GameState,
    setup: LocalGameSetup,
    hooks: LocalControllerHooks = {},
    /** Moves already played (a resumed game). */
    log: readonly LoggedMove[] = [],
  ) {
    const humans = state.players.filter((p) => p.type === 'human').map((p) => p.id);
    super(state, humans);
    this.setup = setup;
    this.hooks = hooks;
    this.log = [...log];
  }

  getLog(): readonly LoggedMove[] {
    return this.log;
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
    this.log = [...this.log, { edgeId, playerId, cells: result.completedCells.length }];
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
    this.hooks.onChange?.(result.gameState, this.setup, this.log);
    if (result.gameOver) this.hooks.onFinished?.(result.gameState, this.setup, this.log);
    this.afterMove();
    return true;
  }

  /** Hook for subclasses (CPU scheduling). */
  protected afterMove(): void {}

  restart(): void {
    const gameId = this.hooks.newGameId?.() ?? crypto.randomUUID();
    const state = newLocalGame(this.setup, gameId, this.now());
    this.log = [];
    this.update({ state, lastEvent: null, paused: false, error: null });
    this.hooks.onChange?.(state, this.setup, this.log);
    this.afterMove();
  }
}
