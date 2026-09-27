'use client';

import { create } from 'zustand';
import { CpuController } from '@/controllers/cpu-controller';
import { LocalController, newLocalGame } from '@/controllers/local-controller';
import type { LocalGameSetup } from '@/controllers/local-controller';
import type { GameController } from '@/controllers/types';
import { saveGame } from '@/persistence/db';
import type { SavedGame } from '@/persistence/db';
import { createWorkerRunner } from '@/workers/cpu-runner';
import type { CpuRunner } from '@/workers/cpu-runner';
import { useProgress } from './progress-store';

interface SessionStore {
  controller: GameController | null;
  /** Setup of the active local/CPU game (for rematch / next level). */
  setup: LocalGameSetup | null;
  /** Resolves once the new game is saved, so a full page load can resume it. */
  startLocal(setup: LocalGameSetup): Promise<GameController>;
  resume(saved: SavedGame): GameController;
  setController(controller: GameController | null): void;
  end(): void;
}

let runner: CpuRunner | null = null;
const getRunner = () => (runner ??= createWorkerRunner());

function humanPerspective(setup: LocalGameSetup): string | null {
  if (setup.create.mode !== 'cpu') return null;
  return setup.create.players.find((p) => p.type === 'human')?.id ?? null;
}

function buildController(state: SavedGame['state'], setup: LocalGameSetup): GameController {
  const hooks = {
    onChange: (s: SavedGame['state'], su: LocalGameSetup) => {
      if (s.status === 'playing') void saveGame(s, su);
    },
    onFinished: (s: SavedGame['state'], su: LocalGameSetup) => {
      void useProgress.getState().recordGame(s, humanPerspective(su));
    },
  };
  return setup.create.mode === 'cpu'
    ? new CpuController(state, setup, getRunner(), hooks)
    : new LocalController(state, setup, hooks);
}

export const useSession = create<SessionStore>((set, get) => ({
  controller: null,
  setup: null,
  async startLocal(setup) {
    get().controller?.dispose();
    const state = newLocalGame(setup, crypto.randomUUID(), Date.now());
    const controller = buildController(state, setup);
    set({ controller, setup });
    await saveGame(state, setup);
    return controller;
  },
  resume(saved) {
    get().controller?.dispose();
    const controller = buildController(saved.state, saved.setup);
    set({ controller, setup: saved.setup });
    return controller;
  },
  setController(controller) {
    get().controller?.dispose();
    set({ controller, setup: null });
  },
  end() {
    get().controller?.dispose();
    set({ controller: null, setup: null });
  },
}));

/** True while a local/CPU game is in progress (used to defer PWA updates). */
export function hasActiveLocalGame(): boolean {
  const { controller, setup } = useSession.getState();
  return !!controller && !!setup && controller.getView().state.status === 'playing';
}
