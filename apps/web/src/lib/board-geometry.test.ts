import { describe, expect, it } from 'vitest';
import {
  PADDING,
  SPACING,
  describeEdge,
  dotPosition,
  edgeInDirection,
  edgeMidpoint,
  nearestEdge,
  viewBoxSize,
} from './board-geometry';

const size = { rows: 4, columns: 4 };
const all = () => true;

describe('board geometry', () => {
  it('sizes the viewBox from the dot grid', () => {
    expect(viewBoxSize(size)).toEqual({ width: 3 * SPACING + 2 * PADDING, height: 3 * SPACING + 2 * PADDING });
    expect(viewBoxSize({ rows: 3, columns: 6 }).width).toBe(5 * SPACING + 2 * PADDING);
  });

  it('computes edge midpoints', () => {
    const d = dotPosition(0, 0);
    expect(edgeMidpoint('H-0-0', size)).toEqual({ x: d.x + SPACING / 2, y: d.y });
    expect(edgeMidpoint('V-0-0', size)).toEqual({ x: d.x, y: d.y + SPACING / 2 });
    expect(edgeMidpoint('H-9-9', size)).toBeNull();
  });
});

describe('nearestEdge', () => {
  it('picks the edge under an imprecise tap', () => {
    const mid = edgeMidpoint('H-1-1', size)!;
    expect(nearestEdge({ x: mid.x + 20, y: mid.y + 25 }, size, all)).toBe('H-1-1');
    const v = edgeMidpoint('V-2-3', size)!;
    expect(nearestEdge({ x: v.x - 30, y: v.y - 10 }, size, all)).toBe('V-2-3');
  });

  it('ignores taps too far from any edge (cell centres)', () => {
    const centre = { x: PADDING + SPACING * 1.5, y: PADDING + SPACING * 1.5 };
    expect(nearestEdge(centre, size, all)).toBeNull();
    expect(nearestEdge({ x: -500, y: -500 }, size, all)).toBeNull();
  });

  it('skips unavailable edges in favour of a nearby available one', () => {
    const mid = edgeMidpoint('H-1-1', size)!;
    const point = { x: mid.x - 40, y: mid.y + 5 };
    expect(nearestEdge(point, size, all)).toBe('H-1-1');
    expect(nearestEdge(point, size, (id) => id !== 'H-1-1')).toBe('V-1-1');
  });
});

describe('keyboard navigation', () => {
  const candidates = ['H-0-0', 'H-0-1', 'H-1-0', 'V-0-0', 'V-0-1', 'H-3-2'];

  it('moves in the arrow direction', () => {
    expect(edgeInDirection('H-0-0', 'right', size, candidates)).toBe('H-0-1');
    expect(edgeInDirection('H-0-0', 'down', size, candidates)).toBe('H-1-0');
    expect(edgeInDirection('H-0-1', 'left', size, candidates)).toBe('H-0-0');
    expect(edgeInDirection('H-0-0', 'up', size, candidates)).toBeNull();
  });

  it('describes edges for screen readers', () => {
    expect(describeEdge('H-0-1', size)).toBe('Horizontal line in row 1, between columns 2 and 3');
    expect(describeEdge('V-2-0', size)).toBe('Vertical line in column 1, between rows 3 and 4');
  });
});
