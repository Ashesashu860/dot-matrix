import { PRESENCE_GRACE_MS } from '@dots/protocol';
import type { GameDoc, RoomPlayerDoc, SubmitMoveRequest, SubmitMoveResponse } from '@dots/protocol';
import { BaseController } from './base-controller';
import type { ConnectionStatus } from './types';

export interface GameSnapshot {
  game: GameDoc;
  /** Served from the local cache (server unreachable). */
  fromCache: boolean;
}

/** Everything the online controller needs from the backend; Firebase in the app, fakes in tests. */
export interface OnlineTransport {
  subscribeGame(onSnapshot: (snapshot: GameSnapshot) => void, onError: (error: unknown) => void): () => void;
  subscribePlayers(onPlayers: (players: RoomPlayerDoc[]) => void): () => void;
  submitMove(request: SubmitMoveRequest): Promise<SubmitMoveResponse>;
  claimInactivity(targetUid: string): Promise<unknown>;
  newMoveId(): string;
}

/** Error codes surfaced by the transport (OnlineError in the app). */
interface CodedError {
  code?: string;
}

const RETRYABLE = new Set(['NETWORK']);
const SILENT = new Set(['STALE_STATE']);

/**
 * Online play: the server is the authority. The board renders the latest
 * Firestore snapshot; a submitted edge shows as pending until the snapshot
 * confirms it. Retries reuse the same clientMoveId, so a flaky connection can
 * never duplicate or reorder a move (§6.4).
 */
export class OnlineController extends BaseController {
  private seq: number;
  private pendingSeq: number | null = null;
  private unsubscribers: Array<() => void> = [];
  private inactivityTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private firestoreConnected = true;
  private rtdbConnected = true;
  private disposed = false;

  constructor(
    initial: GameDoc,
    readonly uid: string,
    private readonly transport: OnlineTransport,
    private readonly graceMs = PRESENCE_GRACE_MS,
  ) {
    super(initial.state, [uid]);
    this.seq = initial.seq;
    this.unsubscribers.push(
      transport.subscribeGame(
        (snapshot) => this.onGame(snapshot),
        () => this.update({ connection: 'offline' }),
      ),
      transport.subscribePlayers((players) => this.onPlayers(players)),
    );
  }

  /** Realtime Database `.info/connected` state from the presence tracker. */
  setRealtimeConnected(connected: boolean): void {
    this.rtdbConnected = connected;
    this.refreshConnection();
  }

  private refreshConnection() {
    const connection: ConnectionStatus =
      this.firestoreConnected && this.rtdbConnected
        ? 'connected'
        : typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'offline'
          : 'reconnecting';
    if (connection !== this.view.connection) this.update({ connection });
  }

  private onGame({ game, fromCache }: GameSnapshot) {
    this.firestoreConnected = !fromCache;
    const previous = this.view.state;
    const next = game.state;
    this.seq = game.seq;
    const patch: Parameters<BaseController['update']>[0] = { state: next };

    // Clear the pending edge once the server has accepted our move (or moved past it).
    if (this.pendingSeq !== null && game.seq > this.pendingSeq) {
      this.pendingSeq = null;
      patch.pendingEdgeId = null;
    }

    const move = next.lastMove;
    if (move && next.totalMoves > previous.totalMoves) {
      const gameOver = next.status === 'finished';
      const current = next.players[next.currentPlayerIndex];
      patch.lastEvent = {
        id: this.nextEventId(),
        edgeId: move.edgeId,
        playerId: move.playerId,
        completedCells: move.completedCells,
        gameOver,
        extraTurn: !gameOver && move.completedCells.length > 0 && current?.id === move.playerId,
      };
    }
    this.update(patch);
    this.refreshConnection();
  }

  private onPlayers(players: RoomPlayerDoc[]) {
    const disconnected = players.filter((p) => !p.connected);
    this.update({ disconnectedPlayerIds: disconnected.map((p) => p.uid) });

    // Any remaining player may ask the server to drop someone offline past the
    // grace period; the server re-checks the timestamps itself.
    for (const [uid, timer] of this.inactivityTimers) {
      if (!disconnected.some((p) => p.uid === uid)) {
        clearTimeout(timer);
        this.inactivityTimers.delete(uid);
      }
    }
    for (const p of disconnected) {
      if (p.uid === this.uid || this.inactivityTimers.has(p.uid) || p.disconnectedAt === null) continue;
      const delay = Math.max(0, p.disconnectedAt + this.graceMs + 500 - Date.now());
      this.inactivityTimers.set(
        p.uid,
        setTimeout(() => {
          this.inactivityTimers.delete(p.uid);
          const target = this.view.state.players.find((pl) => pl.id === p.uid);
          if (this.disposed || this.view.state.status !== 'playing' || !target?.active) return;
          void this.transport.claimInactivity(p.uid).catch(() => {});
        }, delay),
      );
    }
  }

  submitMove(edgeId: string): void {
    const { state, pendingEdgeId } = this.view;
    const current = state.players[state.currentPlayerIndex];
    if (pendingEdgeId !== null || state.status !== 'playing' || current?.id !== this.uid) return;
    const expectedSeq = this.seq;
    const request: SubmitMoveRequest = {
      gameId: state.gameId,
      edgeId,
      expectedSeq,
      clientMoveId: this.transport.newMoveId(),
    };
    this.pendingSeq = expectedSeq;
    this.update({ pendingEdgeId: edgeId, error: null });
    void this.send(request, 0);
  }

  private async send(request: SubmitMoveRequest, attempt: number): Promise<void> {
    try {
      await this.transport.submitMove(request);
      // Keep the pending edge until the snapshot arrives (onGame clears it).
      if (this.seq > request.expectedSeq) this.update({ pendingEdgeId: null });
    } catch (error) {
      const code = (error as CodedError).code ?? 'UNKNOWN';
      if (RETRYABLE.has(code) && attempt < 3 && !this.disposed) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
        return this.send(request, attempt + 1);
      }
      if (this.pendingSeq === request.expectedSeq) this.pendingSeq = null;
      this.update({ pendingEdgeId: null, error: SILENT.has(code) ? null : code });
    }
  }

  override dispose(): void {
    this.disposed = true;
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    for (const timer of this.inactivityTimers.values()) clearTimeout(timer);
    this.inactivityTimers.clear();
    super.dispose();
  }
}
