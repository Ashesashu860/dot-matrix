import type { PlayerShape } from '@/lib/players';

/** Shape centred at (cx, cy) with half-size r, for use inside an <svg>. */
export function ShapePath({
  shape,
  cx,
  cy,
  r,
  ...rest
}: { shape: PlayerShape; cx: number; cy: number; r: number } & React.SVGProps<SVGElement>) {
  const props = rest as React.SVGProps<SVGPolygonElement>;
  switch (shape) {
    case 'circle':
      return <circle cx={cx} cy={cy} r={r * 0.9} {...(rest as React.SVGProps<SVGCircleElement>)} />;
    case 'square':
      return (
        <rect
          x={cx - r * 0.8}
          y={cy - r * 0.8}
          width={r * 1.6}
          height={r * 1.6}
          rx={r * 0.2}
          {...(rest as React.SVGProps<SVGRectElement>)}
        />
      );
    case 'triangle':
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy + r * 0.8} ${cx - r},${cy + r * 0.8}`} {...props} />;
    case 'diamond':
      return <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} {...props} />;
  }
}

/** Small inline icon version for scoreboards and lists. */
export function PlayerShapeIcon({
  shape,
  color,
  size = 16,
  className,
}: {
  shape: PlayerShape;
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className}>
      <ShapePath shape={shape} cx={10} cy={10} r={8} fill={color} />
    </svg>
  );
}
