import { describe, expect, it } from 'vitest';
import { DEFAULT_VOLUME, volumeToGain } from './feedback';

describe('volumeToGain', () => {
  it('keeps the default mix at the default slider position', () => {
    expect(volumeToGain(DEFAULT_VOLUME)).toBe(1);
  });

  it('is silent at 0 and about +4 dB at 100', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(20 * Math.log10(volumeToGain(100))).toBeCloseTo(3.9, 1);
  });

  it('clamps out-of-range values and rises monotonically', () => {
    expect(volumeToGain(-10)).toBe(0);
    expect(volumeToGain(150)).toBe(volumeToGain(100));
    for (let v = 5; v <= 100; v += 5) expect(volumeToGain(v)).toBeGreaterThan(volumeToGain(v - 5));
  });
});
