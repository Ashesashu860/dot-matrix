export interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Token bucket: `capacity` burst, refilling `refillPerMinute` tokens per minute. */
export function takeToken(
  bucket: Bucket | undefined,
  now: number,
  capacity: number,
  refillPerMinute: number,
): { allowed: boolean; bucket: Bucket } {
  const current = bucket ?? { tokens: capacity, updatedAt: now };
  const elapsedMinutes = Math.max(0, now - current.updatedAt) / 60_000;
  const tokens = Math.min(capacity, current.tokens + elapsedMinutes * refillPerMinute);
  if (tokens < 1) return { allowed: false, bucket: { tokens, updatedAt: now } };
  return { allowed: true, bucket: { tokens: tokens - 1, updatedAt: now } };
}
