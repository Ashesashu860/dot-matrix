/**
 * Shared contract between the web client and Cloud Functions: callable request /
 * response schemas, Firestore document shapes, error codes and small helpers.
 */
import { MAX_LEVEL, MAX_PLAYERS, MIN_DOTS, MIN_PLAYERS } from '@dots/game-engine';
import type { GameState, MoveError, PlayerStats } from '@dots/game-engine';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants

export const PLAYER_NAME_MAX = 20;
export const ROOM_CODE_LENGTH = 6;
/** No 0/O, 1/I/L to keep codes easy to read aloud. */
export const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const PRESENCE_GRACE_MS = 60_000;
/** Rooms nobody touches are removed by a Firestore TTL policy on `expiresAt`. */
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const ROOM_CREATE_LIMIT = { capacity: 5, refillPerMinute: 1 } as const;

export const PLAYER_COLORS = ['#FF3D7F', '#1E9BFF', '#FFB21E', '#21C46B'] as const;

export const CALLABLE_REGION = 'us-central1';

// ---------------------------------------------------------------------------
// Errors

export type ProtocolErrorCode =
  | MoveError
  | 'UNAUTHENTICATED'
  | 'INVALID_ARGUMENT'
  | 'RATE_LIMITED'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_NOT_JOINABLE'
  | 'NOT_HOST'
  | 'NOT_IN_ROOM'
  | 'NOT_ENOUGH_PLAYERS'
  | 'PLAYERS_NOT_READY'
  | 'GAME_NOT_FOUND'
  | 'STALE_STATE'
  | 'PLAYER_STILL_CONNECTED';

export const ERROR_MESSAGES: Record<ProtocolErrorCode, string> = {
  GAME_NOT_PLAYING: 'This game is not in progress.',
  UNKNOWN_PLAYER: 'You are not playing in this game.',
  NOT_YOUR_TURN: "It's not your turn.",
  INVALID_EDGE: 'That line is not on the board.',
  EDGE_ALREADY_USED: 'That line was just taken.',
  UNAUTHENTICATED: 'Please sign in to play online.',
  INVALID_ARGUMENT: 'Invalid request.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  ROOM_NOT_FOUND: 'Room not found. Check the code and try again.',
  ROOM_FULL: 'That room is full.',
  ROOM_NOT_JOINABLE: 'That game has already started.',
  NOT_HOST: 'Only the host can do that.',
  NOT_IN_ROOM: 'You are not in this room.',
  NOT_ENOUGH_PLAYERS: 'At least two players are needed.',
  PLAYERS_NOT_READY: 'Everyone must be ready first.',
  GAME_NOT_FOUND: 'Game not found.',
  STALE_STATE: 'The board changed. Syncing…',
  PLAYER_STILL_CONNECTED: 'That player is still connected.',
};

// ---------------------------------------------------------------------------
// Helpers

/** Trim, collapse whitespace, drop control/markup characters and cap the length. */
export function sanitizePlayerName(raw: string): string {
  return raw
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PLAYER_NAME_MAX)
    .trim();
}

export function generateRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export function normaliseRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Zero-padded move document ID so lexical order equals move order. */
export function moveDocId(seq: number): string {
  return String(seq).padStart(5, '0');
}

// ---------------------------------------------------------------------------
// Callable request / response schemas

const playerName = z
  .string()
  .max(100)
  .transform(sanitizePlayerName)
  .refine((s) => s.length > 0, 'Name is required');

/**
 * Online games cap custom boards well below the engine's limit: the whole game
 * state is one Firestore document, rewritten and sent to every player on each
 * move (a 50×50 board is ~730 KB, near the 1 MiB document limit).
 */
export const ONLINE_MAX_DOTS = 12;

export const boardSchema = z.union([
  z.object({ level: z.number().int().min(1).max(MAX_LEVEL) }),
  z.object({
    level: z.literal(0),
    rows: z.number().int().min(MIN_DOTS).max(ONLINE_MAX_DOTS),
    columns: z.number().int().min(MIN_DOTS).max(ONLINE_MAX_DOTS),
  }),
]);

export const createRoomRequest = z.object({
  name: playerName,
  board: boardSchema,
  maxPlayers: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS).default(MAX_PLAYERS),
  extraTurnOnCapture: z.boolean().default(true),
});
export type CreateRoomRequest = z.input<typeof createRoomRequest>;
export interface CreateRoomResponse {
  roomId: string;
  code: string;
}

export const joinRoomRequest = z.object({
  code: z
    .string()
    .max(20)
    .transform(normaliseRoomCode)
    .refine((c) => c.length === ROOM_CODE_LENGTH, 'Invalid room code'),
  name: playerName,
});
export type JoinRoomRequest = z.input<typeof joinRoomRequest>;
export interface JoinRoomResponse {
  roomId: string;
}

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);

export const roomRequest = z.object({ roomId: id });
export type RoomRequest = z.input<typeof roomRequest>;

export const setPlayerReadyRequest = z.object({ roomId: id, ready: z.boolean() });
export type SetPlayerReadyRequest = z.input<typeof setPlayerReadyRequest>;

export interface StartGameResponse {
  gameId: string;
}

export const submitMoveRequest = z.object({
  gameId: id,
  edgeId: z.string().min(1).max(16),
  expectedSeq: z.number().int().min(0),
  clientMoveId: id,
});
export type SubmitMoveRequest = z.input<typeof submitMoveRequest>;
export interface SubmitMoveResponse {
  acceptedSeq: number;
  duplicate: boolean;
}

export const gameRequest = z.object({ gameId: id });
export type GameRequest = z.input<typeof gameRequest>;

export const claimInactivityRequest = z.object({ gameId: id, targetUid: id });
export type ClaimInactivityRequest = z.input<typeof claimInactivityRequest>;

export interface ReconnectResponse {
  roomId: string | null;
  gameId: string | null;
}

export interface OkResponse {
  ok: true;
}

// ---------------------------------------------------------------------------
// Firestore documents

export type RoomStatus = 'waiting' | 'starting' | 'playing' | 'finished' | 'cancelled';

export interface RoomDoc {
  code: string;
  hostUid: string;
  status: RoomStatus;
  maxPlayers: number;
  level: number;
  rows: number;
  columns: number;
  extraTurnOnCapture: boolean;
  /** Current members, in join order. Used by security rules. */
  playerUids: string[];
  activeGameId: string | null;
  currentPlayerUid: string | null;
  totalMoves: number;
  createdAt: number;
  updatedAt: number;
  /** Firestore Timestamp in storage; TTL policy field. */
  expiresAt: unknown;
}

export interface RoomPlayerDoc {
  uid: string;
  name: string;
  color: string;
  ready: boolean;
  joinedAt: number;
  connected: boolean;
  disconnectedAt: number | null;
}

/** The authoritative live game: engine state plus server bookkeeping. */
export interface GameDoc {
  state: GameState;
  roomId: string;
  /** Next expected move sequence number (== accepted move count). */
  seq: number;
  memberUids: string[];
  turnStartedAt: number;
  createdAt: number;
  updatedAt: number;
  resultsProcessed: boolean;
}

export interface MoveDoc {
  seq: number;
  edgeId: string;
  playerUid: string;
  completedCells: string[];
  clientMoveId: string;
  at: number;
}

export interface PlayerStatsDoc extends PlayerStats {
  uid: string;
  updatedAt: number;
}

export interface UserDoc {
  displayName: string;
  createdAt: number;
}

/** RTDB presence node at /status/{roomId}/{uid}. */
export interface PresenceNode {
  state: 'online' | 'offline';
  at: number | object;
}

export const CALLABLES = [
  'createRoom',
  'joinRoom',
  'leaveRoom',
  'setPlayerReady',
  'startGame',
  'submitMove',
  'reconnectPlayer',
  'forfeitGame',
  'claimInactivity',
] as const;
export type CallableName = (typeof CALLABLES)[number];
