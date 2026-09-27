'use client';

import { getLevel } from '@dots/game-engine';
import { BarChart3, Bot, Globe, HelpCircle, Play, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandLogo } from '@/components/brand-logo';
import { InstallHint } from '@/components/pwa/install-hint';
import { Button } from '@/components/ui/button';
import { navigate } from '@/lib/navigation';
import { loadSavedGame } from '@/persistence/db';
import type { SavedGame } from '@/persistence/db';
import { useSession } from '@/stores/session-store';

export function HomeScreen() {
  const router = useRouter();
  const [saved, setSaved] = useState<SavedGame | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadSavedGame().then((g) => !cancelled && setSaved(g));
    return () => {
      cancelled = true;
    };
  }, []);

  const resume = () => {
    if (!saved) return;
    useSession.getState().resume(saved);
    navigate(router, '/play');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-4 pb-8 pt-[max(env(safe-area-inset-top),2rem)]">
      <section className="flex flex-col items-center gap-3 pt-6 text-center">
        <BrandLogo size={140} />
        <h1 className="text-4xl font-extrabold tracking-tight">Box Hunt</h1>
        <p className="text-lg text-primary">Connect. Capture. Conquer.</p>
      </section>

      {saved && (
        <button
          onClick={resume}
          className="flex items-center gap-3 rounded-2xl border-2 border-primary/40 bg-primary/10 p-4 text-left transition hover:bg-primary/15"
        >
          <Play className="size-6 text-primary" />
          <span className="flex-1">
            <span className="block font-semibold">Resume game</span>
            <span className="text-sm text-muted-foreground">
              {saved.state.mode === 'cpu' ? 'vs CPU' : 'Local'} ·{' '}
              {getLevel(saved.state.level) ? `Level ${saved.state.level}` : `${saved.state.rows}×${saved.state.columns}`} ·{' '}
              {saved.state.players.map((p) => `${p.name} ${p.score}`).join(' – ')}
            </span>
          </span>
        </button>
      )}

      <nav className="flex flex-col gap-3" aria-label="Game modes">
        <ModeButton href="/play/setup?mode=cpu" icon={<Bot />} title="Play vs CPU" subtitle="Beat the computer, unlock levels" primary />
        <ModeButton href="/play/setup?mode=local" icon={<Users />} title="Local Game" subtitle="2–4 players on this device" />
        <ModeButton href="/online" icon={<Globe />} title="Online Game" subtitle="Play friends with a room code" />
      </nav>

      <nav className="grid grid-cols-3 gap-2" aria-label="More">
        <Button asChild variant="ghost" className="h-auto flex-col gap-1 py-3">
          <Link href="/how-to-play">
            <HelpCircle className="size-5" />
            <span className="text-xs">How to Play</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto flex-col gap-1 py-3">
          <Link href="/stats">
            <BarChart3 className="size-5" />
            <span className="text-xs">Stats</span>
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-auto flex-col gap-1 py-3">
          <Link href="/settings">
            <Settings className="size-5" />
            <span className="text-xs">Settings</span>
          </Link>
        </Button>
      </nav>

      <InstallHint />
    </main>
  );
}

function ModeButton({
  href,
  icon,
  title,
  subtitle,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? 'flex items-center gap-4 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg shadow-primary/25 transition active:scale-[0.98]'
          : 'flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition hover:border-primary/40 active:scale-[0.98]'
      }
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-white/15 [&>svg]:size-6">{icon}</span>
      <span>
        <span className="block text-lg font-semibold">{title}</span>
        <span className={primary ? 'text-sm opacity-85' : 'text-sm text-muted-foreground'}>{subtitle}</span>
      </span>
    </Link>
  );
}
