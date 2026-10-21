'use client';

import { applyResultToStats, computeResultSummary, emptyStats } from '@dots/game-engine';
import type { GameResultSummary, GameState, PlayerStats } from '@dots/game-engine';
import { create } from 'zustand';
import type { LoggedMove } from '@/controllers/local-controller';
import { DEFAULT_CAMPAIGN, chapterFromLegacyLevel, getStage, starsFor } from '@/lib/campaign';
import type { CampaignProgress } from '@/lib/campaign';
import {
  addHistory,
  clearSavedGame,
  listHistory,
  loadCampaign,
  loadProgress,
  loadStats,
  saveCampaign,
  saveStats,
} from '@/persistence/db';
import type { HistoryEntry } from '@/persistence/db';

interface ProgressStore {
  hydrated: boolean;
  campaign: CampaignProgress;
  stats: PlayerStats;
  history: HistoryEntry[];
  hydrate(): Promise<void>;
  /**
   * Record a finished game: history, stats and campaign stars. `perspective`
   * is the local human (CPU mode) or this device's online player; null for
   * shared-device games.
   */
  recordGame(
    state: GameState,
    perspective: string | null,
    campaign?: { stage: string; log: readonly LoggedMove[] },
  ): Promise<GameResultSummary>;
}

export const useProgress = create<ProgressStore>((set, get) => ({
  hydrated: false,
  campaign: DEFAULT_CAMPAIGN,
  stats: emptyStats(),
  history: [],
  async hydrate() {
    if (get().hydrated) return;
    const [progress, stored, stats, history] = await Promise.all([
      loadProgress(),
      loadCampaign(),
      loadStats(),
      listHistory(),
    ]);
    const grantedChapter = Math.max(stored.grantedChapter, chapterFromLegacyLevel(progress.unlockedLevel));
    set({ hydrated: true, campaign: { ...stored, grantedChapter }, stats, history });
  },
  async recordGame(state, perspective, campaignGame) {
    await get().hydrate();
    const summary = computeResultSummary(state);
    const stats = applyResultToStats(get().stats, summary, perspective);
    const before = get().campaign;
    let campaign = before;
    const stage = campaignGame && getStage(campaignGame.stage);
    if (stage) {
      const stars = starsFor(stage, state, campaignGame.log);
      if (stars > (campaign.stars[stage.id] ?? 0)) {
        campaign = { ...campaign, stars: { ...campaign.stars, [stage.id]: stars } };
      }
    }
    const entry: HistoryEntry = { ...summary, perspectivePlayerId: perspective };
    set({ stats, campaign, history: [entry, ...get().history].slice(0, 20) });
    await Promise.all([
      saveStats(stats),
      campaign === before ? Promise.resolve() : saveCampaign(campaign),
      addHistory(entry),
      state.mode === 'online' ? Promise.resolve() : clearSavedGame(),
    ]);
    return summary;
  },
}));
