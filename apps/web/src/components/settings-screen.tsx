'use client';

import { Volume1, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { CardLabel } from '@/components/kit';
import { PageShell } from '@/components/page-shell';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { playSound, vibrate } from '@/lib/feedback';
import type { Settings } from '@/persistence/db';
import { useProgress } from '@/stores/progress-store';
import { useSettings } from '@/stores/settings-store';

type VolumeKey = 'soundVolume' | 'musicVolume';

const TOGGLES: Array<{ key: keyof Settings; label: string; hint: string; volume?: VolumeKey }> = [
  { key: 'sound', label: 'Sound', hint: 'Pops, chimes and fanfares', volume: 'soundVolume' },
  { key: 'music', label: 'Music', hint: 'Box Hunt theme', volume: 'musicVolume' },
  { key: 'vibration', label: 'Vibration', hint: 'Haptic taps on capture' },
  { key: 'animations', label: 'Animations', hint: 'Bursts, confetti and motion' },
  { key: 'cpuFirst', label: 'CPU moves first', hint: 'Bots make the opening move vs CPU' },
];

const THEMES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const noopSubscribe = () => () => {};

export function SettingsScreen() {
  const settings = useSettings();
  const stats = useProgress((s) => s.stats);
  const { theme, setTheme } = useTheme();
  // Theme is only known on the client.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const activeTheme = mounted ? (theme ?? 'system') : 'system';

  const statItems: Array<[string, number, string]> = [
    ['Played', stats.gamesPlayed, '#2B1B4A'],
    ['Won', stats.gamesWon, '#DB1F63'],
    ['Draws', stats.draws, '#2B1B4A'],
    ['Boxes', stats.cellsCaptured, '#0A73CC'],
    ['Best score', stats.highestScore, '#9A5E00'],
    ['Best streak', stats.longestWinStreak, '#0F7A40'],
  ];

  return (
    <PageShell title="Settings">
      <section className="card-3d flex flex-col px-4 py-1">
        {TOGGLES.map(({ key, label, hint, volume }) => (
          <div key={key} className="flex flex-col gap-2.5 border-b-[1.5px] border-[#F3EEF8] py-[13px]">
            <div className="flex items-center gap-3">
              <label htmlFor={key} className="flex flex-1 flex-col gap-px">
                <span className="text-[17px] font-extrabold text-ink">{label}</span>
                <span className="text-[13px] font-bold text-label">{hint}</span>
              </label>
              <Switch
                id={key}
                checked={settings[key] as boolean}
                onCheckedChange={(checked) => {
                  settings.set({ [key]: checked });
                  if (checked && key === 'sound') playSound('capture');
                  if (checked && key === 'vibration') vibrate(40);
                }}
              />
            </div>
            {volume && (
              <div className="flex items-center gap-3">
                <Volume1 aria-hidden className="size-4 shrink-0 text-label" />
                <Slider
                  aria-label={`${label} volume`}
                  min={0}
                  max={100}
                  step={5}
                  value={[settings[volume]]}
                  disabled={!settings[key]}
                  onValueChange={([v]) => v !== undefined && settings.set({ [volume]: v })}
                  // Preview the effects level once the user lets go.
                  onValueCommit={() => key === 'sound' && playSound('capture')}
                />
                <Volume2 aria-hidden className="size-4 shrink-0 text-label" />
                <span className="w-9 text-right text-xs font-extrabold text-label tabular-nums">{settings[volume]}%</span>
              </div>
            )}
          </div>
        ))}
        <div className="flex flex-col gap-2.5 py-3.5">
          <span id="theme-label" className="text-[17px] font-extrabold text-ink">
            Theme
          </span>
          <div role="radiogroup" aria-labelledby="theme-label" className="flex gap-1.5 rounded-2xl bg-soft p-1">
            {THEMES.map((t) => {
              const selected = activeTheme === t.value;
              return (
                <button
                  key={t.value}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setTheme(t.value)}
                  className="h-10 flex-1 cursor-pointer rounded-xl text-[15px] font-extrabold text-ink transition-all duration-150"
                  style={{ background: selected ? '#fff' : 'transparent', boxShadow: selected ? '0 3px 0 #E3D6EF' : 'none' }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="flex items-baseline justify-between px-1 pt-1">
        <CardLabel className="text-screen-soft!">Your stats</CardLabel>
        <Link href="/stats" className="text-xs font-extrabold text-screen-soft underline decoration-2 underline-offset-2">
          History & more
        </Link>
      </div>
      <dl className="grid grid-cols-3 gap-2.5">
        {statItems.map(([k, v, color]) => (
          <div key={k} className="flex flex-col-reverse items-center gap-0.5 rounded-[20px] bg-white px-1.5 py-3.5 shadow-[0_4px_0_#EFE3CE]">
            <dt className="text-center text-[10px] font-black tracking-[1px] text-label uppercase">{k}</dt>
            <dd className="font-display text-[28px] leading-none font-extrabold" style={{ color }}>
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </PageShell>
  );
}
