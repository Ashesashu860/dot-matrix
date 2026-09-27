'use client';

import {
  MAX_LEVEL,
  applyResultToStats,
  computeResultSummary,
  emptyStats,
} from '@dots/game-engine';
import type { GameResultSummary, GameState, PlayerStats } from '@dots/game-engine';
import { create } from 'zustand';
import {
  DEFAULT_PROGRESS,
  addHistory,
  clearSavedGame,
  listHistory,
  loadProgress,
  loadStats,
  saveProgress,
  saveStats,
} from '@/persistence/db';
import type { HistoryEntry } from '@/persistence/db';

interface ProgressStore {
  hydrated: boolean;
  unlockedLevel: number;
  stats: PlayerStats;
  history: HistoryEntry[];
  hydrate(): Promise<void>;
  /**
   * Record a finished game: history, stats and CPU level unlocks. `perspective`
   * is the local human (CPU mode) or this device's online player; null for
   * shared-device games.
   */
  recordGame(state: GameState, perspective: string | null): Promise<GameResultSummary>;
}

export const useProgress = create<ProgressStore>((set, get) => ({
  hydrated: false,
  unlockedLevel: DEFAULT_PROGRESS.unlockedLevel,
  stats: emptyStats(),
  history: [],
  async hydrate() {
    if (get().hydrated) return;
    const [progress, stats, history] = await Promise.all([loadProgress(), loadStats(), listHistory()]);
    set({ hydrated: true, unlockedLevel: progress.unlockedLevel, stats, history });
  },
  async recordGame(state, perspective) {
    await get().hydrate();
    const summary = computeResultSummary(state);
    const stats = applyResultToStats(get().stats, summary, perspective);
    const won =
      perspective !== null && !summary.isDraw && summary.winnerIds.includes(perspective);
    let unlockedLevel = get().unlockedLevel;
    if (state.mode === 'cpu' && won && state.level >= unlockedLevel && state.level < MAX_LEVEL) {
      unlockedLevel = state.level + 1;
    }
    const entry: HistoryEntry = { ...summary, perspectivePlayerId: perspective };
    set({ stats, unlockedLevel, history: [entry, ...get().history].slice(0, 20) });
    await Promise.all([
      saveStats(stats),
      saveProgress({ unlockedLevel }),
      addHistory(entry),
      state.mode === 'online' ? Promise.resolve() : clearSavedGame(),
    ]);
    return summary;
  },
}));
