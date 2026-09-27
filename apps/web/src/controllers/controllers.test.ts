import type { GameState } from '@dots/game-engine';
import { describe, expect, it, vi } from 'vitest';
import { createInlineRunner } from '@/workers/cpu-runner';
import { CpuController } from './cpu-controller';
import { LocalController, newLocalGame } from './local-controller';
import type { LocalGameSetup } from './local-controller';
import { canInteract } from './types';

const localSetup: LocalGameSetup = {
  create: {
    mode: 'local',
    level: 1,
    rows: 3,
    columns: 3,
    players: [
      { id: 'a', name: 'Ada', type: 'human', color: '#00f' },
      { id: 'b', name: 'Bob', type: 'human', color: '#f00' },
    ],
  },
  seed: 1,
};

const cpuSetup: LocalGameSetup = {
  create: {
    mode: 'cpu',
    level: 1,
    rows: 4,
    columns: 4,
    players: [
      { id: 'me', name: 'Me', type: 'human', color: '#00f' },
      { id: 'cpu1', name: 'CPU', type: 'cpu', color: '#f00' },
    ],
  },
  difficulty: 'hard',
  seed: 7,
};

const flush = () => new Promise((r) => setTimeout(r, 0));

async function until(predicate: () => boolean, timeoutMs = 5000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('timed out');
    await flush();
  }
}

describe('LocalController', () => {
  it('applies moves for whoever is current and emits events', () => {
    const onChange = vi.fn();
    const c = new LocalController(newLocalGame(localSetup, 'g', 0), localSetup, { onChange });
    const listener = vi.fn();
    c.subscribe(listener);
    expect(canInteract(c.getView())).toBe(true);
    c.submitMove('H-0-0');
    expect(c.getView().state.edges['H-0-0']?.claimedBy).toBe('a');
    expect(c.getView().state.currentPlayerIndex).toBe(1);
    expect(c.getView().lastEvent).toMatchObject({ id: 1, edgeId: 'H-0-0', playerId: 'a' });
    expect(listener).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('reports engine rejections without changing state', () => {
    const c = new LocalController(newLocalGame(localSetup, 'g', 0), localSetup);
    c.submitMove('H-0-0');
    const before = c.getView().state;
    c.submitMove('H-0-0');
    expect(c.getView().state).toBe(before);
    expect(c.getView().error).toBe('EDGE_ALREADY_USED');
  });

  it('ignores moves while paused and calls onFinished once at the end', () => {
    const onFinished = vi.fn();
    const c = new LocalController(newLocalGame(localSetup, 'g', 0), localSetup, {
      onFinished,
      now: () => 5,
    });
    c.pause();
    c.submitMove('H-0-0');
    expect(c.getView().state.totalMoves).toBe(0);
    c.resume();
    for (const id of Object.keys(c.getView().state.edges)) c.submitMove(id);
    expect(c.getView().state.status).toBe('finished');
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(c.getView().state.endedAt).toBe(5);
  });

  it('restart creates a fresh game with the same setup', () => {
    const c = new LocalController(newLocalGame(localSetup, 'g', 0), localSetup, {
      newGameId: () => 'g2',
    });
    c.submitMove('H-0-0');
    c.restart();
    expect(c.getView().state.gameId).toBe('g2');
    expect(c.getView().state.totalMoves).toBe(0);
  });
});

describe('CpuController', () => {
  const hooks = { minThinkMs: 0, wait: async () => {} };

  it('opens with the CPU when cpuFirst is set, including after a restart', async () => {
    const setup = { ...cpuSetup, cpuFirst: true };
    const state = newLocalGame(setup, 'g', 0);
    expect(state.currentPlayerIndex).toBe(1);
    const c = new CpuController(state, setup, createInlineRunner(), hooks);
    await until(() => c.getView().state.totalMoves === 1);
    expect(Object.values(c.getView().state.edges).find((e) => e.claimedBy)?.claimedBy).toBe('cpu1');
    c.restart();
    await until(() => c.getView().state.totalMoves === 1);
    expect(Object.values(c.getView().state.edges).find((e) => e.claimedBy)?.claimedBy).toBe('cpu1');
    c.dispose();
  });

  it('lets the human open by default', () => {
    expect(newLocalGame(cpuSetup, 'g', 0).currentPlayerIndex).toBe(0);
  });

  it('lets the human move, then the CPU replies automatically', async () => {
    const c = new CpuController(newLocalGame(cpuSetup, 'g', 0), cpuSetup, createInlineRunner(), hooks);
    expect(c.getView().controllablePlayerIds).toEqual(['me']);
    c.submitMove('H-0-0');
    await until(() => c.getView().state.totalMoves === 2);
    expect(c.getView().state.players[c.getView().state.currentPlayerIndex]?.id).toBe('me');
    // Human cannot move for the CPU.
    expect(canInteract(c.getView())).toBe(true);
    c.dispose();
  });

  it('starts immediately when a resumed game is on the CPU turn', async () => {
    let state: GameState = newLocalGame(cpuSetup, 'g', 0);
    state = { ...state, currentPlayerIndex: 1 };
    const c = new CpuController(state, cpuSetup, createInlineRunner(), hooks);
    await until(() => c.getView().state.totalMoves === 1);
    c.dispose();
  });

  it('plays a full game to completion with no corrupted state', async () => {
    const onFinished = vi.fn();
    const c = new CpuController(newLocalGame(cpuSetup, 'g', 0), cpuSetup, createInlineRunner(), {
      ...hooks,
      onFinished,
    });
    while (c.getView().state.status === 'playing') {
      const view = c.getView();
      if (canInteract(view)) {
        const free = Object.values(view.state.edges).find((e) => !e.claimedBy)!;
        c.submitMove(free.id);
      }
      await flush();
    }
    const final = c.getView().state;
    expect(final.players.reduce((s, p) => s + p.score, 0)).toBe(9);
    expect(onFinished).toHaveBeenCalledTimes(1);
    c.dispose();
  });

  it('discards an in-flight CPU move when paused', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const c = new CpuController(newLocalGame(cpuSetup, 'g', 0), cpuSetup, createInlineRunner(), {
      minThinkMs: 10,
      wait: () => gate,
    });
    c.submitMove('H-0-0');
    await until(() => c.getView().thinking);
    c.pause();
    release();
    await flush();
    await flush();
    expect(c.getView().state.totalMoves).toBe(1);
    expect(c.getView().thinking).toBe(false);
    c.resume();
    await until(() => c.getView().state.totalMoves === 2);
    c.dispose();
  });
});
