import { describe, expect, it } from 'vitest';
import { DEFAULT_CAMPAIGN } from './campaign';
import {
  EMPTY_BOOK,
  activeProfile,
  addProfile,
  cleanName,
  nameTaken,
  removeProfile,
  resetProfile,
  switchProfile,
  updateProfile,
} from './profiles';

const look = (name: string) => ({ name, color: '#FF3D7F', shape: 'circle' as const });
const earned = { stars: { '1-1': 3, '1-2': 2 }, grantedChapter: 2 };

describe('profiles', () => {
  it('cleans names', () => {
    expect(cleanName('  Ada   Lovelace ')).toBe('Ada Lovelace');
    expect(cleanName('   ')).toBe('');
    expect(cleanName('x'.repeat(40))).toHaveLength(20);
  });

  it('adds a profile, makes it active and seeds its campaign', () => {
    const book = addProfile(EMPTY_BOOK, look(' Ada '), 'a', 1, earned);
    expect(activeProfile(book)).toMatchObject({ id: 'a', name: 'Ada', campaign: earned });
    const two = addProfile(book, look('Bo'), 'b', 2);
    expect(two.activeId).toBe('b');
    expect(activeProfile(two)!.campaign).toEqual(DEFAULT_CAMPAIGN);
  });

  it('finds taken names regardless of case, except the profile being edited', () => {
    const book = addProfile(EMPTY_BOOK, look('Ada'), 'a', 1);
    expect(nameTaken(book, ' ada ')).toBe(true);
    expect(nameTaken(book, 'ada', 'a')).toBe(false);
    expect(nameTaken(book, 'Bo')).toBe(false);
  });

  it('switches, edits and resets only the chosen profile', () => {
    let book = addProfile(addProfile(EMPTY_BOOK, look('Ada'), 'a', 1, earned), look('Bo'), 'b', 2, earned);
    book = switchProfile(book, 'a');
    expect(book.activeId).toBe('a');
    expect(switchProfile(book, 'missing')).toBe(book);
    book = updateProfile(book, 'a', { name: '  Ada L ' });
    expect(book.profiles[0]!.name).toBe('Ada L');
    book = resetProfile(book, 'a');
    expect(book.profiles[0]!.campaign).toEqual(DEFAULT_CAMPAIGN);
    expect(book.profiles[1]!.campaign).toEqual(earned);
  });

  it('moves to another profile when the active one is deleted', () => {
    const book = addProfile(addProfile(EMPTY_BOOK, look('Ada'), 'a', 1), look('Bo'), 'b', 2);
    expect(removeProfile(book, 'b').activeId).toBe('a');
    expect(removeProfile(switchProfile(book, 'a'), 'b').activeId).toBe('a');
    expect(removeProfile(removeProfile(book, 'b'), 'a')).toEqual(EMPTY_BOOK);
  });
});
