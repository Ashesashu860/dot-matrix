import { emptyStats } from '@dots/game-engine';
import type { GameResultSummary, GameState, PlayerStats } from '@dots/game-engine';
import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { LocalGameSetup } from '@/controllers/local-controller';

/**
 * IndexedDB persistence for everything local (requirements §10.1). CPU/local play
 * never depends on Firebase. Every call degrades to an in-memory fallback when
 * IndexedDB is unavailable (private mode, old browsers) so the game still works.
 */

export interface Settings {
  sound: boolean;
  music: boolean;
  vibration: boolean;
  animations: boolean;
  extraTurnOnCapture: boolean;
  lastPlayerNames: string[];
  onlineName: string;
}

export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: false,
  vibration: true,
  animations: true,
  extraTurnOnCapture: true,
  lastPlayerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  onlineName: '',
};

export interface Progress {
  /** Highest level unlocked for CPU play. */
  unlockedLevel: number;
}

export const DEFAULT_PROGRESS: Progress = { unlockedLevel: 1 };

export interface SavedGame {
  state: GameState;
  setup: LocalGameSetup;
  savedAt: number;
}

export type HistoryEntry = GameResultSummary & { perspectivePlayerId: string | null };

interface DotsDB extends DBSchema {
  kv: {
    key: 'settings' | 'progress' | 'stats';
    value: unknown;
  };
  savedGame: {
    key: 'current';
    value: SavedGame;
  };
  history: {
    key: string;
    value: HistoryEntry & { recordedAt: number };
    indexes: { recordedAt: number };
  };
}

const DB_NAME = 'dots-matrix';
const DB_VERSION = 1;
export const HISTORY_LIMIT = 100;

let dbPromise: Promise<IDBPDatabase<DotsDB> | null> | null = null;
const memory = new Map<string, unknown>();

function db(): Promise<IDBPDatabase<DotsDB> | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbPromise ??= openDB<DotsDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('kv');
      database.createObjectStore('savedGame');
      const history = database.createObjectStore('history', { keyPath: 'gameId' });
      history.createIndex('recordedAt', 'recordedAt');
    },
  }).catch(() => null);
  return dbPromise;
}

async function getKv<T>(key: 'settings' | 'progress' | 'stats', fallback: T): Promise<T> {
  try {
    const d = await db();
    const value = d ? await d.get('kv', key) : memory.get(key);
    return value === undefined ? fallback : { ...fallback, ...(value as object) };
  } catch {
    return fallback;
  }
}

async function setKv(key: 'settings' | 'progress' | 'stats', value: unknown): Promise<void> {
  try {
    const d = await db();
    if (d) await d.put('kv', value, key);
    else memory.set(key, value);
  } catch {
    memory.set(key, value);
  }
}

export const loadSettings = () => getKv<Settings>('settings', DEFAULT_SETTINGS);
export const saveSettings = (s: Settings) => setKv('settings', s);
export const loadProgress = () => getKv<Progress>('progress', DEFAULT_PROGRESS);
export const saveProgress = (p: Progress) => setKv('progress', p);
export const loadStats = () => getKv<PlayerStats>('stats', emptyStats());
export const saveStats = (s: PlayerStats) => setKv('stats', s);

export async function loadSavedGame(): Promise<SavedGame | null> {
  try {
    const d = await db();
    const saved = d ? await d.get('savedGame', 'current') : (memory.get('savedGame') as SavedGame);
    return saved && saved.state.status === 'playing' ? saved : null;
  } catch {
    return null;
  }
}

export async function saveGame(state: GameState, setup: LocalGameSetup): Promise<void> {
  const value: SavedGame = { state, setup, savedAt: Date.now() };
  try {
    const d = await db();
    if (d) await d.put('savedGame', value, 'current');
    else memory.set('savedGame', value);
  } catch {
    memory.set('savedGame', value);
  }
}

export async function clearSavedGame(): Promise<void> {
  try {
    const d = await db();
    if (d) await d.delete('savedGame', 'current');
  } catch {
    // ignore
  }
  memory.delete('savedGame');
}

export async function addHistory(entry: HistoryEntry): Promise<void> {
  try {
    const d = await db();
    if (!d) return;
    const tx = d.transaction('history', 'readwrite');
    await tx.store.put({ ...entry, recordedAt: Date.now() });
    // Keep the newest HISTORY_LIMIT entries.
    const count = await tx.store.count();
    if (count > HISTORY_LIMIT) {
      let cursor = await tx.store.index('recordedAt').openCursor();
      for (let i = 0; i < count - HISTORY_LIMIT && cursor; i++) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
    }
    await tx.done;
  } catch {
    // History is best-effort.
  }
}

export async function listHistory(limit = 20): Promise<HistoryEntry[]> {
  try {
    const d = await db();
    if (!d) return [];
    const all = await d.getAllFromIndex('history', 'recordedAt');
    return all.reverse().slice(0, limit);
  } catch {
    return [];
  }
}
