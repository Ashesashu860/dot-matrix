import { cellId, cellsAdjacentToEdge, edgeId, parseEdgeId } from './ids';
import { MAX_PLAYERS, MIN_PLAYERS, isValidBoardSize } from './levels';
import type {
  Cell,
  Edge,
  GameConfig,
  GameMode,
  GameState,
  GameStatus,
  MoveRecord,
  MoveResult,
  Player,
  PlayerType,
  WinnerResult,
} from './types';

export const DEFAULT_CONFIG: GameConfig = { extraTurnOnCapture: true };

export interface PlayerInit {
  id: string;
  name: string;
  type: PlayerType;
  color: string;
}

export interface CreateGameOptions {
  gameId: string;
  mode: GameMode;
  level: number;
  rows: number;
  columns: number;
  players: PlayerInit[];
  config?: Partial<GameConfig>;
  /** Defaults to `playing`; online lobbies may create a `waiting` game. */
  status?: GameStatus;
  startedAt?: number;
}

export interface Board {
  edges: Record<string, Edge>;
  cells: Record<string, Cell>;
}

/** Generate every edge and cell for a `rows` x `columns` dot grid. */
export function generateBoard(rows: number, columns: number): Board {
  if (!isValidBoardSize(rows, columns)) {
    throw new RangeError(`Unsupported board size ${rows}x${columns}`);
  }
  const edges: Record<string, Edge> = {};
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const id = edgeId('horizontal', r, c);
      edges[id] = { id, orientation: 'horizontal', row: r, column: c };
    }
  }
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < columns; c++) {
      const id = edgeId('vertical', r, c);
      edges[id] = { id, orientation: 'vertical', row: r, column: c };
    }
  }
  const cells: Record<string, Cell> = {};
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const id = cellId(r, c);
      cells[id] = {
        id,
        row: r,
        column: c,
        top: edgeId('horizontal', r, c),
        right: edgeId('vertical', r, c + 1),
        bottom: edgeId('horizontal', r + 1, c),
        left: edgeId('vertical', r, c),
      };
    }
  }
  return { edges, cells };
}

/** Create a deterministic initial game state. */
export function createGame(options: CreateGameOptions): GameState {
  const { players } = options;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new RangeError(`A game needs ${MIN_PLAYERS}-${MAX_PLAYERS} players`);
  }
  if (new Set(players.map((p) => p.id)).size !== players.length) {
    throw new Error('Player IDs must be unique');
  }
  const { edges, cells } = generateBoard(options.rows, options.columns);
  const state: GameState = {
    gameId: options.gameId,
    mode: options.mode,
    level: options.level,
    rows: options.rows,
    columns: options.columns,
    players: players.map((p) => ({ ...p, score: 0, active: true })),
    edges,
    cells,
    currentPlayerIndex: 0,
    status: options.status ?? 'playing',
    totalMoves: 0,
    config: { ...DEFAULT_CONFIG, ...options.config },
  };
  if (options.startedAt !== undefined) state.startedAt = options.startedAt;
  return state;
}

export function getCurrentPlayer(state: GameState): Player | undefined {
  return state.players[state.currentPlayerIndex];
}

/** All edges that can still be selected. */
export function getValidMoves(state: GameState): Edge[] {
  if (state.status !== 'playing') return [];
  return Object.values(state.edges).filter((e) => e.claimedBy === undefined);
}

/** Whether `edgeId` exists on this board and is unclaimed. */
export function isValidMove(state: GameState, id: string): boolean {
  if (state.status !== 'playing') return false;
  if (!parseEdgeId(id, state.rows, state.columns)) return false;
  const edge = state.edges[id];
  return edge !== undefined && edge.claimedBy === undefined;
}

function isCellComplete(cell: Cell, edges: Record<string, Edge>): boolean {
  return (
    edges[cell.top]?.claimedBy !== undefined &&
    edges[cell.right]?.claimedBy !== undefined &&
    edges[cell.bottom]?.claimedBy !== undefined &&
    edges[cell.left]?.claimedBy !== undefined
  );
}

/**
 * Unowned cells bordering `id` whose four edges are all claimed in `edges`.
 * Only the (at most two) adjacent cells are inspected.
 */
export function findCompletedCells(state: GameState, id: string, edges = state.edges): string[] {
  const parsed = parseEdgeId(id, state.rows, state.columns);
  if (!parsed) return [];
  return cellsAdjacentToEdge(parsed, state.rows, state.columns).filter((cid) => {
    const cell = state.cells[cid];
    return cell !== undefined && cell.ownerId === undefined && isCellComplete(cell, edges);
  });
}

/** Assign ownership of `cellIds` to `playerId` and add one point per cell. */
export function claimCells(
  state: GameState,
  cellIds: readonly string[],
  playerId: string,
): Pick<GameState, 'cells' | 'players'> {
  if (cellIds.length === 0) return { cells: state.cells, players: state.players };
  const cells = { ...state.cells };
  for (const id of cellIds) {
    const cell = cells[id];
    if (cell) cells[id] = { ...cell, ownerId: playerId };
  }
  const players = state.players.map((p) =>
    p.id === playerId ? { ...p, score: p.score + cellIds.length } : p,
  );
  return { cells, players };
}

/** Index of the player who moves next; keeps the current player on an extra turn. */
export function getNextPlayer(state: GameState, extraTurn: boolean): number {
  const count = state.players.length;
  const current = state.currentPlayerIndex;
  if (extraTurn && state.players[current]?.active) return current;
  for (let step = 1; step <= count; step++) {
    const index = (current + step) % count;
    if (state.players[index]?.active) return index;
  }
  return current;
}

/** True when every cell is owned or fewer than two players remain active. */
export function isGameOver(state: Pick<GameState, 'cells' | 'players'>): boolean {
  const allClaimed = Object.values(state.cells).every((c) => c.ownerId !== undefined);
  const activePlayers = state.players.filter((p) => p.active).length;
  return allClaimed || activePlayers < MIN_PLAYERS;
}

/** Highest-scoring active player(s); more than one means a draw. */
export function getWinner(state: Pick<GameState, 'players'>): WinnerResult {
  const contenders = state.players.filter((p) => p.active);
  if (contenders.length === 0) return { winnerIds: [], isDraw: false };
  const best = Math.max(...contenders.map((p) => p.score));
  const winnerIds = contenders.filter((p) => p.score === best).map((p) => p.id);
  return { winnerIds, isDraw: winnerIds.length > 1 };
}

function finish(state: GameState, now: number | undefined): GameState {
  const { winnerIds, isDraw } = getWinner(state);
  const finished: GameState = { ...state, status: 'finished', winnerIds, isDraw };
  if (now !== undefined) finished.endedAt = now;
  return finished;
}

export interface ApplyMoveOptions {
  /** Timestamp recorded as `endedAt` if this move ends the game. */
  now?: number;
}

/** Validate and apply a move. Never mutates `state`. */
export function applyMove(
  state: GameState,
  id: string,
  playerId: string,
  options: ApplyMoveOptions = {},
): MoveResult {
  if (state.status !== 'playing') return { ok: false, error: 'GAME_NOT_PLAYING' };
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.active) return { ok: false, error: 'UNKNOWN_PLAYER' };
  if (getCurrentPlayer(state)?.id !== playerId) return { ok: false, error: 'NOT_YOUR_TURN' };
  if (!parseEdgeId(id, state.rows, state.columns)) return { ok: false, error: 'INVALID_EDGE' };
  const edge = state.edges[id];
  if (!edge) return { ok: false, error: 'INVALID_EDGE' };
  if (edge.claimedBy !== undefined) return { ok: false, error: 'EDGE_ALREADY_USED' };

  const edges = { ...state.edges, [id]: { ...edge, claimedBy: playerId } };
  const completedCells = findCompletedCells(state, id, edges);
  const { cells, players } = claimCells(state, completedCells, playerId);

  let next: GameState = {
    ...state,
    edges,
    cells,
    players,
    totalMoves: state.totalMoves + 1,
    lastMove: { edgeId: id, playerId, completedCells },
  };

  // The final cell ends the match before any further turn is created.
  const gameOver = isGameOver(next);
  const extraTurn = !gameOver && completedCells.length > 0 && state.config.extraTurnOnCapture;
  if (gameOver) {
    next = finish(next, options.now);
  } else {
    next.currentPlayerIndex = getNextPlayer(next, extraTurn);
  }

  return {
    ok: true,
    gameState: next,
    completedCells,
    scoreGained: completedCells.length,
    extraTurn,
    gameOver,
  };
}

/**
 * Mark a player inactive (forfeit / disconnect timeout). Their turns are skipped
 * and the game ends if fewer than two players remain.
 */
export function forfeitPlayer(
  state: GameState,
  playerId: string,
  options: ApplyMoveOptions = {},
): GameState {
  const index = state.players.findIndex((p) => p.id === playerId);
  if (index === -1 || !state.players[index]!.active || state.status === 'finished') return state;
  const players = state.players.map((p) => (p.id === playerId ? { ...p, active: false } : p));
  let next: GameState = { ...state, players };
  if (state.status === 'playing' && isGameOver(next)) return finish(next, options.now);
  if (state.currentPlayerIndex === index) {
    next = { ...next, currentPlayerIndex: getNextPlayer(next, false) };
  }
  return next;
}

/** Re-apply a sequence of moves from an initial state. Throws on the first illegal move. */
export function replay(initial: GameState, moves: readonly MoveRecord[]): GameState {
  let state = initial;
  moves.forEach((move, index) => {
    const result = applyMove(state, move.edgeId, move.playerId);
    if (!result.ok) {
      throw new Error(`Move ${index} (${move.edgeId}) rejected: ${result.error}`);
    }
    state = result.gameState;
  });
  return state;
}

/** Number of cells a player owns (equals score, kept separate for result screens). */
export function countCells(state: GameState, playerId: string): number {
  return Object.values(state.cells).filter((c) => c.ownerId === playerId).length;
}
