import { PLAYER_COLORS } from '@dots/protocol';

/** Shapes give every player a non-colour identity (a11y §8.4). */
export const PLAYER_SHAPES = ['circle', 'triangle', 'square', 'diamond'] as const;
export type PlayerShape = (typeof PLAYER_SHAPES)[number];

export const PLAYER_SYMBOLS: Record<PlayerShape, string> = {
  circle: '●',
  triangle: '▲',
  square: '■',
  diamond: '◆',
};

export const COLOR_CHOICES = [...PLAYER_COLORS] as const;

/** Darker "edge" shade of each player colour, used for chunky 3D shadows. */
const DARK: Record<string, string> = {
  '#ff3d7f': '#D61F63',
  '#1e9bff': '#0A73CC',
  '#ffb21e': '#D98900',
  '#21c46b': '#139650',
};

export function darkShade(color: string): string {
  return DARK[color.toLowerCase()] ?? `color-mix(in srgb, ${color} 78%, black)`;
}

/**
 * Accessible variants. The design's pink/blue/green are too light for white
 * text (WCAG AA), so surfaces that carry text use deeper shades. Board boxes and
 * tokens keep the original colours.
 */
const SURFACE: Record<string, { bg: string; edge: string }> = {
  '#ff3d7f': { bg: '#DB1F63', edge: '#A3144A' },
  '#1e9bff': { bg: '#0A73CC', edge: '#075597' },
  '#21c46b': { bg: '#0F7A40', edge: '#0A5A2F' },
};

/** Background for a player-coloured surface that shows text. */
export function surfaceShade(color: string): string {
  return SURFACE[color.toLowerCase()]?.bg ?? color;
}

/** Bottom edge for a surface drawn with `surfaceShade`. */
export function surfaceEdge(color: string): string {
  return SURFACE[color.toLowerCase()]?.edge ?? darkShade(color);
}

/** A player colour dark enough to use as text on white. */
export function textShade(color: string): string {
  return color.toLowerCase() === '#ffb21e' ? '#9A5E00' : surfaceShade(color);
}

/** Text colour that reads on a player colour (amber needs dark ink). */
export function inkOn(color: string): string {
  return color.toLowerCase() === '#ffb21e' ? '#2B1B4A' : '#FFFFFF';
}

export function shapeForIndex(index: number): PlayerShape {
  return PLAYER_SHAPES[index % PLAYER_SHAPES.length]!;
}

export function formatDuration(ms: number | undefined): string {
  if (ms === undefined) return '—';
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

/** mm:ss clock, e.g. 02:05. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
