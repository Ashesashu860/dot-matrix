'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { PageShell, Section } from '@/components/page-shell';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { playSound, vibrate } from '@/lib/feedback';
import type { Settings } from '@/persistence/db';
import { useSettings } from '@/stores/settings-store';

const TOGGLES: Array<{ key: keyof Settings; label: string; hint: string }> = [
  { key: 'sound', label: 'Sound effects', hint: 'Lines, captures and wins' },
  { key: 'music', label: 'Music', hint: 'Soft background tune' },
  { key: 'vibration', label: 'Vibration', hint: 'Haptic feedback on captures (where supported)' },
  { key: 'animations', label: 'Animations', hint: 'Also reduced automatically if your device prefers less motion' },
];

const noopSubscribe = () => () => {};

export function SettingsScreen() {
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  // Theme is only known on the client.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  return (
    <PageShell title="Settings">
      <Section title="Theme">
        <ToggleGroup
          type="single"
          variant="outline"
          value={mounted ? (theme ?? 'system') : 'system'}
          onValueChange={(v) => v && setTheme(v)}
          className="w-full"
          aria-label="Theme"
        >
          <ToggleGroupItem value="light" className="flex-1">
            <Sun /> Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="flex-1">
            <Moon /> Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="system" className="flex-1">
            <Monitor /> System
          </ToggleGroupItem>
        </ToggleGroup>
      </Section>

      <Section title="Feedback">
        <ul className="flex flex-col divide-y rounded-xl bg-card shadow-sm">
          {TOGGLES.map(({ key, label, hint }) => (
            <li key={key} className="flex items-center justify-between gap-4 p-3">
              <Label htmlFor={key} className="flex flex-col items-start gap-0.5">
                <span>{label}</span>
                <span className="text-xs font-normal text-muted-foreground">{hint}</span>
              </Label>
              <Switch
                id={key}
                checked={settings[key] as boolean}
                onCheckedChange={(checked) => {
                  settings.set({ [key]: checked });
                  if (checked && key === 'sound') playSound('capture');
                  if (checked && key === 'vibration') vibrate(40);
                }}
              />
            </li>
          ))}
        </ul>
      </Section>
    </PageShell>
  );
}
