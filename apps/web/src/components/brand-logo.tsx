import { PLAYER_COLORS } from '@dots/protocol';
import { ShapePath } from '@/components/game/player-shape';
import { shapeForIndex } from '@/lib/players';

const N = 4;
const SP = 46;
const PAD = 16;
const SIZE = PAD * 2 + SP * (N - 1);
/** [row, column, player] boxes that pop in and out in turn. */
const FILLS: Array<[number, number, number]> = [
  [0, 0, 0],
  [1, 1, 1],
  [2, 2, 2],
  [0, 2, 3],
  [2, 0, 1],
  [1, 0, 0],
];

/** Tilted mini-board whose boxes keep getting captured. */
export function BrandLogo() {
  const lines: Array<[number, number, number, number]> = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N - 1; c++) lines.push([c, r, c + 1, r]);
  for (let r = 0; r < N - 1; r++) for (let c = 0; c < N; c++) lines.push([c, r, c, r + 1]);

  return (
    <div className="animate-[bh-bob_4s_ease-in-out_infinite]">
      <div
        className="rounded-[34px] bg-white p-2"
        style={{ transform: 'rotate(-5deg)', boxShadow: '0 8px 0 #EFE3CE, 0 24px 40px -16px rgba(43,27,74,.35)' }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {FILLS.map(([r, c, p], i) => (
            <g
              key={i}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: `bh-logo 5s cubic-bezier(.3,1.6,.5,1) ${i * 0.45}s infinite`,
              }}
            >
              <rect x={PAD + c * SP + 6} y={PAD + r * SP + 6} width={SP - 12} height={SP - 12} rx={9} fill={PLAYER_COLORS[p]} />
              <ShapePath shape={shapeForIndex(p)} cx={PAD + (c + 0.5) * SP} cy={PAD + (r + 0.5) * SP} r={6} fill="#fff" />
            </g>
          ))}
          {lines.map(([c1, r1, c2, r2]) => (
            <line
              key={`${c1}${r1}${c2}${r2}`}
              x1={PAD + c1 * SP}
              y1={PAD + r1 * SP}
              x2={PAD + c2 * SP}
              y2={PAD + r2 * SP}
              stroke="#2B1B4A"
              strokeOpacity={0.14}
              strokeWidth={6}
              strokeLinecap="round"
            />
          ))}
          {Array.from({ length: N * N }, (_, i) => (
            <circle key={i} cx={PAD + (i % N) * SP} cy={PAD + Math.floor(i / N) * SP} r={6.5} fill="#2B1B4A" />
          ))}
        </svg>
      </div>
    </div>
  );
}

const TILES: Array<{ ch: string; bg: string; edge: string; fg: string; tilt: number }> = [
  { ch: 'H', bg: '#FF3D7F', edge: '#D61F63', fg: '#fff', tilt: -6 },
  { ch: 'U', bg: '#1E9BFF', edge: '#0A73CC', fg: '#fff', tilt: 4 },
  { ch: 'N', bg: '#FFB21E', edge: '#D98900', fg: '#2B1B4A', tilt: -3 },
  { ch: 'T', bg: '#21C46B', edge: '#139650', fg: '#fff', tilt: 5 },
];

/** "BOX" over lettered tiles spelling "HUNT". Screen readers get the plain name. */
export function Wordmark() {
  return (
    <h1 className="flex flex-col items-center" aria-label="Box Hunt">
      <span aria-hidden="true" className="mt-[18px] font-display text-[60px] leading-[0.9] font-extrabold tracking-[-1px] text-screen">
        BOX
      </span>
      <span aria-hidden="true" className="mt-1 flex gap-[5px]">
        {TILES.map((t) => (
          <span
            key={t.ch}
            className="flex h-[52px] w-[46px] items-center justify-center rounded-[14px] font-display text-[34px] leading-none font-extrabold"
            style={{ background: t.bg, boxShadow: `0 5px 0 ${t.edge}`, color: t.fg, transform: `rotate(${t.tilt}deg)` }}
          >
            {t.ch}
          </span>
        ))}
      </span>
    </h1>
  );
}
