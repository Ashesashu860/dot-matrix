'use client';

import { applyResultToStats, computeResultSummary, emptyStats } from '@dots/game-engine';
import type { GameResultSummary, GameState, PlayerStats } from '@dots/game-engine';
import { create } from 'zustand';
import type { LoggedMove } from '@/controllers/local-controller';
import { DEFAULT_CAMPAIGN, chapterFromLegacyLevel, getStage, starsFor } from '@/lib/campaign';
import type { CampaignProgress } from '@/lib/campaign';
import {
  EMPTY_BOOK,
  activeProfile,
  addProfile,
  removeProfile,
  resetProfile,
  switchProfile,
  updateProfile,
} from '@/lib/profiles';
import type { Profile, ProfileBook, ProfileLook } from '@/lib/profiles';
import {
  DEFAULT_PROGRESS,
  addHistory,
  clearSavedGame,
  listHistory,
  loadCampaign,
  loadProgress,
  loadProfiles,
  loadSavedGame,
  loadStats,
  saveCampaign,
  saveProfiles,
  saveProgress,
  saveStats,
} from '@/persistence/db';
import type { HistoryEntry } from '@/persistence/db';

interface ProgressStore {
  hydrated: boolean;
  book: ProfileBook;
  /** The active profile; the campaign needs one. */
  profile: Profile | null;
  /**
   * The active profile's campaign. With no profiles yet, progress from before
   * profiles, which the first profile adopts.
   */
  campaign: CampaignProgress;
  stats: PlayerStats;
  history: HistoryEntry[];
  hydrate(): Promise<void>;
  createProfile(look: ProfileLook): Promise<Profile>;
  editProfile(id: string, look: Partial<ProfileLook>): Promise<void>;
  switchProfile(id: string): Promise<void>;
  /** Clears a profile's campaign stars. */
  resetProfile(id: string): Promise<void>;
  deleteProfile(id: string): Promise<void>;
  /**
   * Record a finished game: history, stats and campaign stars. `perspective`
   * is the local human (CPU mode) or this device's online player; null for
   * shared-device games. Stars go to `profileId`, else the active profile.
   */
  recordGame(
    state: GameState,
    perspective: string | null,
    campaign?: { stage: string; log: readonly LoggedMove[]; profileId?: string },
  ): Promise<GameResultSummary>;
}

/** Progress from before profiles: the stored campaign plus chapters from the old level ladder. */
async function legacyCampaign(): Promise<CampaignProgress> {
  const [progress, stored] = await Promise.all([loadProgress(), loadCampaign()]);
  return { ...stored, grantedChapter: Math.max(stored.grantedChapter, chapterFromLegacyLevel(progress.unlockedLevel)) };
}

export const useProgress = create<ProgressStore>((set, get) => {
  let legacy: CampaignProgress = DEFAULT_CAMPAIGN;

  /** Saves the book and derives `profile`/`campaign` from it. */
  const commit = async (book: ProfileBook) => {
    const profile = activeProfile(book);
    set({ book, profile, campaign: profile?.campaign ?? (book.profiles.length ? DEFAULT_CAMPAIGN : legacy) });
    await saveProfiles(book);
  };

  /** A saved campaign game belongs to the profile that started it. */
  const dropSavedCampaignGame = async (profileId: string) => {
    const saved = await loadSavedGame();
    if (saved?.setup.campaignStage && (saved.setup.profileId ?? profileId) === profileId) await clearSavedGame();
  };

  return {
    hydrated: false,
    book: EMPTY_BOOK,
    profile: null,
    campaign: DEFAULT_CAMPAIGN,
    stats: emptyStats(),
    history: [],
    async hydrate() {
      if (get().hydrated) return;
      const [book, stats, history] = await Promise.all([loadProfiles(), loadStats(), listHistory()]);
      if (!book.profiles.length) legacy = await legacyCampaign();
      const profile = activeProfile(book);
      set({
        hydrated: true,
        book,
        profile,
        campaign: profile?.campaign ?? (book.profiles.length ? DEFAULT_CAMPAIGN : legacy),
        stats,
        history,
      });
    },
    async createProfile(look) {
      await get().hydrate();
      const { book } = get();
      const first = !book.profiles.length;
      const id = crypto.randomUUID();
      await commit(addProfile(book, look, id, Date.now(), first ? legacy : DEFAULT_CAMPAIGN));
      if (first) {
        // The first profile took over the old progress; clear it so it isn't granted twice.
        legacy = DEFAULT_CAMPAIGN;
        await Promise.all([saveCampaign(DEFAULT_CAMPAIGN), saveProgress(DEFAULT_PROGRESS)]);
      }
      return get().profile!;
    },
    async editProfile(id, look) {
      await commit(updateProfile(get().book, id, look));
    },
    async switchProfile(id) {
      await commit(switchProfile(get().book, id));
    },
    async resetProfile(id) {
      await commit(resetProfile(get().book, id));
      await dropSavedCampaignGame(id);
    },
    async deleteProfile(id) {
      await commit(removeProfile(get().book, id));
      await dropSavedCampaignGame(id);
    },
    async recordGame(state, perspective, campaignGame) {
      await get().hydrate();
      const summary = computeResultSummary(state);
      const stats = applyResultToStats(get().stats, summary, perspective);
      const stage = campaignGame && getStage(campaignGame.stage);
      const { book } = get();
      const owner = book.profiles.find((p) => p.id === (campaignGame?.profileId ?? book.activeId));
      let nextBook: ProfileBook | null = null;
      if (stage && owner) {
        const stars = starsFor(stage, state, campaignGame.log);
        if (stars > (owner.campaign.stars[stage.id] ?? 0)) {
          nextBook = updateProfile(book, owner.id, {
            campaign: { ...owner.campaign, stars: { ...owner.campaign.stars, [stage.id]: stars } },
          });
        }
      }
      const entry: HistoryEntry = { ...summary, perspectivePlayerId: perspective };
      set({ stats, history: [entry, ...get().history].slice(0, 20) });
      await Promise.all([
        saveStats(stats),
        nextBook ? commit(nextBook) : Promise.resolve(),
        addHistory(entry),
        state.mode === 'online' ? Promise.resolve() : clearSavedGame(),
      ]);
      return summary;
    },
  };
});
