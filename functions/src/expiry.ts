import { ASYNC_ROOM_TTL_MS, ROOM_TTL_MS } from '@dots/protocol';
import type { RoomPace } from '@dots/protocol';
import { Timestamp } from 'firebase-admin/firestore';
import { config } from './app';

/** TTL value for a room touched at `t`: async rooms live for days between moves. */
export const roomExpiry = (t: number, pace: RoomPace | undefined) =>
  Timestamp.fromMillis(t + (pace === 'async' ? ASYNC_ROOM_TTL_MS : ROOM_TTL_MS));

/** Deadline for a turn starting at `t`, or null for live games. */
export const turnDeadline = (t: number, pace: RoomPace | undefined) =>
  pace === 'async' ? t + config.asyncTurnMs : null;
