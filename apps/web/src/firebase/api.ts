'use client';

import { ERROR_MESSAGES } from '@dots/protocol';
import type {
  CallableName,
  ClaimInactivityRequest,
  CreateRoomRequest,
  CreateRoomResponse,
  GameRequest,
  JoinRoomRequest,
  JoinRoomResponse,
  OkResponse,
  ProtocolErrorCode,
  ReconnectResponse,
  RoomRequest,
  SetPlayerReadyRequest,
  StartGameResponse,
  SubmitMoveRequest,
  SubmitMoveResponse,
} from '@dots/protocol';
import { httpsCallable } from 'firebase/functions';
import { getFirebase } from './client';

export type OnlineErrorCode = ProtocolErrorCode | 'NETWORK' | 'UNKNOWN';

export class OnlineError extends Error {
  constructor(readonly code: OnlineErrorCode) {
    super(
      code === 'NETWORK'
        ? 'Network problem. Check your connection.'
        : code === 'UNKNOWN'
          ? 'Something went wrong.'
          : ERROR_MESSAGES[code],
    );
  }
}

const NETWORK_CODES = new Set(['functions/unavailable', 'functions/deadline-exceeded', 'functions/internal']);

async function call<Res>(name: CallableName, data: unknown): Promise<Res> {
  try {
    const result = await httpsCallable(getFirebase().functions, name)(data);
    return result.data as Res;
  } catch (error) {
    const e = error as { code?: string; details?: { code?: ProtocolErrorCode } };
    if (e.details?.code) throw new OnlineError(e.details.code);
    if (e.code && NETWORK_CODES.has(e.code)) throw new OnlineError('NETWORK');
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new OnlineError('NETWORK');
    throw new OnlineError('UNKNOWN');
  }
}

/** Typed wrappers for the authoritative callable functions (§5.4). */
export const api = {
  createRoom: (d: CreateRoomRequest) => call<CreateRoomResponse>('createRoom', d),
  joinRoom: (d: JoinRoomRequest) => call<JoinRoomResponse>('joinRoom', d),
  leaveRoom: (d: RoomRequest) => call<OkResponse>('leaveRoom', d),
  setPlayerReady: (d: SetPlayerReadyRequest) => call<OkResponse>('setPlayerReady', d),
  startGame: (d: RoomRequest) => call<StartGameResponse>('startGame', d),
  submitMove: (d: SubmitMoveRequest) => call<SubmitMoveResponse>('submitMove', d),
  reconnectPlayer: () => call<ReconnectResponse>('reconnectPlayer', {}),
  forfeitGame: (d: GameRequest) => call<OkResponse>('forfeitGame', d),
  claimInactivity: (d: ClaimInactivityRequest) => call<OkResponse>('claimInactivity', d),
};
