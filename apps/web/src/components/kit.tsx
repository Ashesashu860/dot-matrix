import Link from 'next/link';
import { Slot } from 'radix-ui';
import type { CSSProperties, ReactNode } from 'react';
import { PlayerShapeIcon } from '@/components/game/player-shape';
import type { PlayerShape } from '@/lib/players';
import { darkShade, inkOn } from '@/lib/players';
import { cn } from '@/lib/utils';

/**
 * Shared building blocks for the Dotsnatch look: chunky buttons with a solid
 * bottom edge, white cards, round back buttons and player tokens.
 */

const TONES = {
  // Pink, blue and green are deepened from the design so white text passes WCAG AA.
  pink: { bg: '#DB1F63', fg: '#FFFFFF', edge: '#A3144A', glow: '0 16px 26px -8px rgba(219,31,99,.55)' },
  blue: { bg: '#0A73CC', fg: '#FFFFFF', edge: '#075597' },
  amber: { bg: '#FFB21E', fg: '#2B1B4A', edge: '#D98900' },
  green: { bg: '#0F7A40', fg: '#FFFFFF', edge: '#0A5A2F' },
  white: { bg: '#FFFFFF', fg: '#2B1B4A', edge: '#E8DCC6' },
  soft: { bg: '#F6F1FB', fg: '#2B1B4A', edge: '#E3D6EF' },
  dark: { bg: '#2B1B4A', fg: '#FFFFFF', edge: '#130B26' },
  off: { bg: '#CFC3E0', fg: '#FFFFFF', edge: '#B7A9CC' },
} as const;

export type Tone = keyof typeof TONES;

export function toneStyle(tone: Tone, lift = 5, glow = false): CSSProperties {
  const t = TONES[tone];
  return {
    background: t.bg,
    color: t.fg,
    '--edge': t.edge,
    '--lift': `${lift}px`,
    ...(glow && 'glow' in t ? { '--glow': t.glow } : {}),
  } as CSSProperties;
}

export function Chunky({
  tone = 'white',
  lift = 5,
  glow,
  asChild,
  className,
  style,
  ...props
}: React.ComponentProps<'button'> & { tone?: Tone; lift?: number; glow?: boolean; asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      className={cn(
        'btn-3d cursor-pointer border-none font-display font-extrabold disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed',
        className,
      )}
      style={{ ...toneStyle(tone, lift, glow), ...style }}
      {...props}
    />
  );
}

/** Full-height mobile column with the rise-in entrance. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col pt-[max(env(safe-area-inset-top),0.5rem)] animate-[bh-rise_.35s_ease-out]',
        className,
      )}
    >
      {children}
    </div>
  );
}

const roundButton =
  'btn-3d flex size-[46px] flex-none items-center justify-center rounded-full border-none bg-white text-ink';

export function RoundButton({
  href,
  label,
  onClick,
  children,
}: {
  href?: string;
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const style = { '--edge': '#EADFCB', '--lift': '4px' } as CSSProperties;
  return href ? (
    <Link href={href} aria-label={label} className={roundButton} style={style}>
      {children}
    </Link>
  ) : (
    <button type="button" aria-label={label} onClick={onClick} className={roundButton} style={style}>
      {children}
    </button>
  );
}

export function BackGlyph() {
  return <span className="pb-1 font-display text-[30px] leading-none font-extrabold">‹</span>;
}

export function ScreenHeader({
  title,
  backHref = '/',
  onBack,
  right,
}: {
  title: string;
  backHref?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 px-5 pt-2 pb-3.5">
      <RoundButton href={onBack ? undefined : backHref} onClick={onBack} label="Back">
        <BackGlyph />
      </RoundButton>
      <h1 className="flex-1 font-display text-[30px] leading-none font-extrabold text-screen">{title}</h1>
      {right}
    </header>
  );
}

/** Scrollable content area; leaves room for a floating bottom action. */
export function ScreenBody({ children, className, withAction }: { children: ReactNode; className?: string; withAction?: boolean }) {
  return (
    <main className={cn('flex flex-1 flex-col gap-3.5 px-5', withAction ? 'pb-6' : 'pb-10', className)}>{children}</main>
  );
}

/** Primary action pinned to the bottom of the screen. */
export function BottomAction({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('sticky bottom-0 z-10 px-5 pt-2 pb-[max(env(safe-area-inset-bottom),28px)]', className)}>
      {children}
    </div>
  );
}

export function Card({ children, className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className={cn('card-3d flex flex-col gap-3 p-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardLabel({ children, className, as: As = 'h2' }: { children: ReactNode; className?: string; as?: 'h2' | 'h3' | 'div' | 'span' }) {
  return <As className={cn('card-label', className)}>{children}</As>;
}

export function Pill({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cn('rounded-full bg-soft px-2.5 py-1.5 text-[10px] font-black tracking-[1px] text-[#6E5E8D]', className)}
      style={style}
    >
      {children}
    </span>
  );
}

/** Round player token: colour plus shape, so identity never relies on colour alone. */
export function PlayerToken({
  color,
  shape,
  size = 40,
  flat,
  inverted,
}: {
  color: string;
  shape: PlayerShape;
  size?: number;
  flat?: boolean;
  inverted?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: inverted ? '#FFFFFF' : color,
        boxShadow: flat || inverted ? undefined : `0 3px 0 ${darkShade(color)}`,
      }}
    >
      <PlayerShapeIcon shape={shape} color={inverted ? color : inkOn(color)} size={Math.round(size * 0.4)} />
    </span>
  );
}
