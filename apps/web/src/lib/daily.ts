import type { DailyProgress, DailyResult } from '@/persistence/db';

/** Tries per daily puzzle. */
export const DAILY_ATTEMPTS = 3;
export const DAILY_HINTS = 1;

export function isDone(result: DailyResult | undefined): boolean {
  return !!result && (result.solved || result.attempts >= DAILY_ATTEMPTS);
}

/** Consecutive solved puzzles ending today, or yesterday if today is still open. */
export function dailyStreak(results: DailyProgress['results'], today: number): number {
  let day = results[today]?.solved ? today : today - 1;
  let streak = 0;
  while (results[day]?.solved) {
    streak++;
    day--;
  }
  return streak;
}

/** Spoiler-free result to share, e.g. "Dotsnatch Daily #42 🟥🟩 💡". */
export function shareText(no: number, result: DailyResult, url: string): string {
  const failed = result.solved ? result.attempts - 1 : result.attempts;
  const marks = '🟥'.repeat(failed) + (result.solved ? '🟩' : '');
  const score = result.solved ? `${result.attempts}/${DAILY_ATTEMPTS}` : `X/${DAILY_ATTEMPTS}`;
  return `Dotsnatch Daily #${no} ${score}\n${marks}${result.hints ? ' 💡' : ''}\n${url}`;
}

/** "3h 12m" until local midnight, when the next puzzle unlocks. */
export function untilNextPuzzle(now: Date): string {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const minutes = Math.max(1, Math.ceil((midnight.getTime() - now.getTime()) / 60_000));
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}
