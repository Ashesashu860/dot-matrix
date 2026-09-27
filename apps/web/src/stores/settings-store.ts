'use client';

import { create } from 'zustand';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/persistence/db';
import type { Settings } from '@/persistence/db';

interface SettingsStore extends Settings {
  hydrated: boolean;
  hydrate(): Promise<void>;
  set(patch: Partial<Settings>): void;
}

export const useSettings = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  hydrated: false,
  async hydrate() {
    if (get().hydrated) return;
    const stored = await loadSettings();
    set({ ...stored, hydrated: true });
  },
  set(patch) {
    set(patch);
    const { hydrated: _h, hydrate: _hy, set: _s, ...settings } = { ...get(), ...patch };
    void saveSettings(settings);
  },
}));
