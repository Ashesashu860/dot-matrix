import type { Difficulty } from '@dots/cpu-engine';
import type { GameState } from '@dots/game-engine';
import type { CpuRunner } from '@/workers/cpu-runner';
import { LocalController } from './local-controller';
import type { LocalControllerHooks, LocalGameSetup } from './local-controller';

export interface CpuControllerHooks extends LocalControllerHooks {
  /** Minimum time a CPU appears to "think", so moves are readable. */
  minThinkMs?: number;
  wait?(ms: number): Promise<void>;
}

const defaultWait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Human vs CPU: local authority, CPU moves computed off the main thread. */
export class CpuController extends LocalController {
  private readonly runner: CpuRunner;
  private readonly cpuHooks: CpuControllerHooks;
  /** Invalidates in-flight CPU work after pause/restart/dispose. */
  private turnToken = 0;
  private disposed = false;

  constructor(
    state: GameState,
    setup: LocalGameSetup,
    runner: CpuRunner,
    hooks: CpuControllerHooks = {},
  ) {
    super(state, setup, hooks);
    this.runner = runner;
    this.cpuHooks = hooks;
    // A resumed game may be waiting on a CPU move.
    queueMicrotask(() => this.afterMove());
  }

  private get difficulty(): Difficulty {
    return this.setup.difficulty ?? 'medium';
  }

  protected override afterMove(): void {
    const { state, paused, thinking } = this.view;
    const current = state.players[state.currentPlayerIndex];
    if (this.disposed || paused || thinking || state.status !== 'playing') return;
    if (current?.type !== 'cpu') return;
    void this.runCpuTurn(current.id);
  }

  private async runCpuTurn(cpuId: string): Promise<void> {
    const token = ++this.turnToken;
    const state = this.view.state;
    this.update({ thinking: true });
    const started = Date.now();
    let edgeId: string;
    try {
      edgeId = await this.runner.choose(state, this.difficulty, this.setup.seed + state.totalMoves);
      const remaining = (this.cpuHooks.minThinkMs ?? 450) - (Date.now() - started);
      if (remaining > 0) await (this.cpuHooks.wait ?? defaultWait)(remaining);
    } catch (error) {
      if (token === this.turnToken) {
        this.update({ thinking: false, error: error instanceof Error ? error.message : 'CPU error' });
      }
      return;
    }
    // Stale: paused, restarted or disposed while thinking.
    if (token !== this.turnToken || this.disposed || this.view.state !== state) {
      if (token === this.turnToken) this.update({ thinking: false });
      return;
    }
    this.update({ thinking: false });
    if (this.view.paused) return;
    this.apply(edgeId, cpuId);
  }

  override pause(): void {
    this.turnToken++;
    this.update({ paused: true, thinking: false });
  }

  override resume(): void {
    super.resume();
    this.afterMove();
  }

  override restart(): void {
    this.turnToken++;
    this.update({ thinking: false });
    super.restart();
  }

  override dispose(): void {
    this.disposed = true;
    this.turnToken++;
    super.dispose();
  }
}
