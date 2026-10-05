'use client';

import { Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { useEffect, useState } from 'react';
import { Chunky } from '@/components/kit';
import { isAndroid, isIos, isStandalone, useInstallPrompt } from './use-install-prompt';

/** "Not now" hides the sheet for a week; the home-screen link stays available. */
const SNOOZE_KEY = 'dotsnatch:install-snoozed-until';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
/** Only ask once per visit, not every time the player returns to the home screen. */
const SESSION_KEY = 'dotsnatch:install-asked';
/** Let the home screen settle before interrupting. */
const OPEN_DELAY_MS = 1200;

function shouldAsk() {
  // Automated browsers (e2e tests) would have the sheet cover the home screen.
  if (isStandalone() || navigator.webdriver) return false;
  try {
    if (sessionStorage.getItem(SESSION_KEY) === '1') return false;
    return Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < Date.now();
  } catch {
    return true;
  }
}

function remember(snooze: boolean) {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
    if (snooze) localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    // storage unavailable
  }
}

/** Asks browser (non-installed) players to install Dotsnatch as an app. */
export function InstallSheet() {
  const { canPrompt, install } = useInstallPrompt();
  const [eligible, setEligible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Reading browser-only APIs must happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEligible(shouldAsk());
    setPlatform(isIos() ? 'ios' : isAndroid() ? 'android' : null);
  }, []);

  // Desktop browsers without the install event (Firefox, Safari) can't install, so skip them.
  const installable = canPrompt || platform !== null;
  useEffect(() => {
    if (!eligible || !installable) return;
    const t = setTimeout(() => {
      remember(false);
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [eligible, installable]);

  const notNow = () => {
    remember(true);
    setEligible(false);
    setOpen(false);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && notNow()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(43,27,74,.55)] backdrop-blur-[6px]" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-48px)] max-w-[382px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-[32px] bg-white px-[22px] pt-7 pb-6 shadow-[0_10px_0_#E3D6EF] outline-none">
          <div className="flex w-full flex-col items-center gap-3 animate-[bh-turn_.3s_cubic-bezier(.3,1.6,.5,1)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" width={72} height={72} className="rounded-[20px] shadow-[0_5px_0_#EFE3CE]" />
            <DialogPrimitive.Title className="text-center font-display text-[32px] leading-none font-extrabold text-ink">
              Install Dotsnatch
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-center text-[15px] leading-snug font-bold text-label">
              Play full screen and offline, right from your home screen.
            </DialogPrimitive.Description>

            {canPrompt ? (
              <Chunky
                tone="pink"
                lift={6}
                onClick={async () => {
                  setOpen(false);
                  await install();
                }}
                className="mt-1.5 flex h-[62px] w-full items-center justify-center gap-2 rounded-[22px] text-2xl"
              >
                <Download className="size-6" aria-hidden />
                Install
              </Chunky>
            ) : (
              <ol className="mt-1 flex w-full flex-col gap-2 rounded-[20px] bg-soft p-4 text-[15px] font-extrabold text-ink">
                {platform === 'ios' ? (
                  <>
                    <li className="flex items-center gap-2">
                      <span className="text-label">1.</span> Tap <Share className="size-5 text-[#0A73CC]" aria-label="Share" />
                      in the browser bar
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-label">2.</span> Choose <SquarePlus className="size-5" aria-hidden />
                      Add to Home Screen
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-center gap-2">
                      <span className="text-label">1.</span> Tap <EllipsisVertical className="size-5" aria-label="the menu" />
                      in the browser bar
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-label">2.</span> Choose Install app or Add to Home screen
                    </li>
                  </>
                )}
              </ol>
            )}

            <Chunky tone="soft" onClick={notNow} className="h-[52px] w-full rounded-[20px] text-lg">
              {canPrompt ? 'Not now' : 'Got it'}
            </Chunky>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
