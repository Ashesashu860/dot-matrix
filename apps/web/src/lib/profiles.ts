import { PLAYER_NAME_MAX } from '@dots/protocol';
import { DEFAULT_CAMPAIGN } from '@/lib/campaign';
import type { CampaignProgress } from '@/lib/campaign';
import type { PlayerShape } from '@/lib/players';

/**
 * Player profiles on this device. Campaign progress belongs to a profile, so
 * several people can share a phone and each keep their own stars.
 */
export interface Profile {
  id: string;
  name: string;
  color: string;
  shape: PlayerShape;
  createdAt: number;
  campaign: CampaignProgress;
}

export interface ProfileBook {
  activeId: string | null;
  profiles: Profile[];
}

export type ProfileLook = Pick<Profile, 'name' | 'color' | 'shape'>;

export const EMPTY_BOOK: ProfileBook = { activeId: null, profiles: [] };
export const MAX_PROFILES = 6;

/** Trimmed, single-spaced and capped; empty when nothing is left. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, PLAYER_NAME_MAX);
}

export function nameTaken(book: ProfileBook, name: string, exceptId?: string): boolean {
  const key = cleanName(name).toLowerCase();
  return book.profiles.some((p) => p.id !== exceptId && p.name.toLowerCase() === key);
}

export function activeProfile(book: ProfileBook): Profile | null {
  return book.profiles.find((p) => p.id === book.activeId) ?? null;
}

/** Adds a profile and makes it active; `campaign` seeds it (progress from before profiles). */
export function addProfile(
  book: ProfileBook,
  look: ProfileLook,
  id: string,
  now: number,
  campaign: CampaignProgress = DEFAULT_CAMPAIGN,
): ProfileBook {
  const profile: Profile = { id, ...look, name: cleanName(look.name), createdAt: now, campaign };
  return { activeId: id, profiles: [...book.profiles, profile] };
}

export function updateProfile(book: ProfileBook, id: string, patch: Partial<Omit<Profile, 'id'>>): ProfileBook {
  return {
    ...book,
    profiles: book.profiles.map((p) =>
      p.id === id ? { ...p, ...patch, ...(patch.name !== undefined && { name: cleanName(patch.name) }) } : p,
    ),
  };
}

/** Back to stage 1-1 with no stars. */
export function resetProfile(book: ProfileBook, id: string): ProfileBook {
  return updateProfile(book, id, { campaign: DEFAULT_CAMPAIGN });
}

/** Removes a profile; the first remaining one becomes active if it was. */
export function removeProfile(book: ProfileBook, id: string): ProfileBook {
  const profiles = book.profiles.filter((p) => p.id !== id);
  const activeId = book.activeId === id ? (profiles[0]?.id ?? null) : book.activeId;
  return { activeId, profiles };
}

export function switchProfile(book: ProfileBook, id: string): ProfileBook {
  return book.profiles.some((p) => p.id === id) ? { ...book, activeId: id } : book;
}
