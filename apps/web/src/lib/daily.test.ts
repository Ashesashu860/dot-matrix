import { describe, expect, it } from 'vitest';
import { dailyStreak, isDone, shareText, untilNextPuzzle } from './daily';

describe('daily puzzle helpers', () => {
  it('counts the streak through today or from yesterday', () => {
    const solved = { attempts: 1, solved: true, hints: 0 };
    expect(dailyStreak({ 8: solved, 9: solved, 10: solved }, 10)).toBe(3);
    expect(dailyStreak({ 8: solved, 9: solved }, 10)).toBe(2);
    expect(dailyStreak({ 8: solved, 10: solved }, 10)).toBe(1);
    expect(dailyStreak({ 9: { attempts: 3, solved: false, hints: 0 } }, 10)).toBe(0);
  });

  it('is done once solved or out of attempts', () => {
    expect(isDone(undefined)).toBe(false);
    expect(isDone({ attempts: 2, solved: false, hints: 0 })).toBe(false);
    expect(isDone({ attempts: 3, solved: false, hints: 0 })).toBe(true);
    expect(isDone({ attempts: 1, solved: true, hints: 0 })).toBe(true);
  });

  it('shares attempts without spoilers', () => {
    expect(shareText(42, { attempts: 2, solved: true, hints: 1 }, 'https://x/daily')).toBe(
      'Dotsnatch Daily #42 2/3\n🟥🟩 💡\nhttps://x/daily',
    );
    expect(shareText(7, { attempts: 3, solved: false, hints: 0 }, 'u')).toBe('Dotsnatch Daily #7 X/3\n🟥🟥🟥\nu');
  });

  it('counts down to local midnight', () => {
    expect(untilNextPuzzle(new Date(2026, 9, 21, 20, 48, 30))).toBe('3h 12m');
    expect(untilNextPuzzle(new Date(2026, 9, 21, 23, 59, 30))).toBe('1m');
  });
});
