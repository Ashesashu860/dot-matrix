import { cellId } from './ids';

/**
 * Shaped boards: a fixed catalog (so online rooms validate by ID). Each shape
 * is drawn as a cell map, one character per box:
 *
 *   `#` a box   `$` a gold box (worth 2)   `.` a hole (no box)
 *
 * `walls` are lines drawn before the game starts; they belong to nobody.
 */
export interface ShapeDefinition {
  id: string;
  name: string;
  art: readonly string[];
  walls?: readonly string[];
}

/** `claimedBy` of a pre-drawn wall. */
export const WALL_ID = '#wall';

/** Points for a gold box. */
export const GOLD_VALUE = 2;

export const SHAPES = {
  cross: {
    id: 'cross',
    name: 'Cross',
    art: ['.###.', '#####', '##$##', '#####', '.###.'],
  },
  ring: {
    id: 'ring',
    name: 'Ring',
    art: ['$####$', '######', '##..##', '##..##', '######', '$####$'],
  },
  diamond: {
    id: 'diamond',
    name: 'Diamond',
    art: ['..##..', '.####.', '##$$##', '##$$##', '.####.', '..##..'],
  },
  twins: {
    id: 'twins',
    name: 'Twin rooms',
    art: ['###.###', '#$#####', '#####$#', '###.###'],
  },
  vault: {
    id: 'vault',
    name: 'Vault',
    art: ['#####', '#$#$#', '##$##', '#$#$#', '#####'],
    walls: ['H-1-2', 'H-4-2', 'V-2-1', 'V-2-4'],
  },
  mini: {
    id: 'mini',
    name: 'Mini cross',
    art: ['.##.', '#$##', '##$#', '.##.'],
  },
  loop: {
    id: 'loop',
    name: 'Loop',
    art: ['$##$', '#..#', '#..#', '$##$'],
  },
} as const satisfies Record<string, ShapeDefinition>;

export type ShapeId = keyof typeof SHAPES;

export const SHAPE_IDS = Object.keys(SHAPES) as ShapeId[];

export function getShape(id: string | undefined): ShapeDefinition | undefined {
  return id !== undefined && Object.hasOwn(SHAPES, id) ? SHAPES[id as ShapeId] : undefined;
}

/** Dot grid that holds the shape. */
export function shapeSize(shape: ShapeDefinition): { rows: number; columns: number } {
  return { rows: shape.art.length + 1, columns: shape.art[0]!.length + 1 };
}

/** Box values by cell ID (holes are absent). */
export function shapeCells(shape: ShapeDefinition): Map<string, number> {
  const cells = new Map<string, number>();
  shape.art.forEach((line, r) =>
    [...line].forEach((ch, c) => {
      if (ch === '#') cells.set(cellId(r, c), 1);
      else if (ch === '$') cells.set(cellId(r, c), GOLD_VALUE);
    }),
  );
  return cells;
}
