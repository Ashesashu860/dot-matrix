'use client';

import { MotionConfig } from 'motion/react';
import { ThemeProvider } from 'next-themes';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { setMusic, setMusicVolume, setSoundVolume } from '@/lib/feedback';
import { useProgress } from '@/stores/progress-store';
import { useSettings } from '@/stores/settings-store';
import { OfflineLinks } from './pwa/offline-links';
import { PwaUpdater } from './pwa/pwa-updater';

function SettingsEffects({ children }: { children: ReactNode }) {
  const animations = useSettings((s) => s.animations);
  const music = useSettings((s) => s.music);
  const hydrated = useSettings((s) => s.hydrated);
  const soundVolume = useSettings((s) => s.soundVolume);
  const musicVolume = useSettings((s) => s.musicVolume);

  useEffect(() => setSoundVolume(soundVolume), [soundVolume]);
  useEffect(() => setMusicVolume(musicVolume), [musicVolume]);

  useEffect(() => {
    void useSettings.getState().hydrate();
    void useProgress.getState().hydrate();
  }, []);

  // Browsers only allow audio after a user gesture: start right away if the user
  // has already interacted (e.g. toggled the setting), otherwise on the first tap.
  useEffect(() => {
    if (!hydrated || !music) {
      setMusic(false);
      return;
    }
    const start = () => setMusic(true);
    if (navigator.userActivation?.hasBeenActive) start();
    window.addEventListener('pointerdown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      setMusic(false);
    };
  }, [music, hydrated]);

  return (
    // "user" honours prefers-reduced-motion; the setting can force it off entirely.
    <MotionConfig reducedMotion={animations ? 'user' : 'always'}>{children}</MotionConfig>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SettingsEffects>{children}</SettingsEffects>
      <Toaster position="top-center" richColors />
      <PwaUpdater />
      <OfflineLinks />
    </ThemeProvider>
  );
}
