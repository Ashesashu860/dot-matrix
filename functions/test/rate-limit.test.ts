import { describe, expect, it } from 'vitest';
import { takeToken } from '../src/rate-limit';

describe('takeToken', () => {
  it('allows a burst up to capacity, then refills over time', () => {
    let bucket;
    for (let i = 0; i < 3; i++) {
      const r = takeToken(bucket, 0, 3, 1);
      expect(r.allowed).toBe(true);
      bucket = r.bucket;
    }
    expect(takeToken(bucket, 1_000, 3, 1).allowed).toBe(false);
    expect(takeToken(bucket, 61_000, 3, 1).allowed).toBe(true);
  });
});
