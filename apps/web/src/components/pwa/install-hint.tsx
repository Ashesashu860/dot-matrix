'use client';

import { Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Pre-rename key, kept so a dismissed hint stays dismissed.
const DISMISS_KEY = 'dots-matrix:install-dismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/** Native install prompt where available; a short "Add to Home Screen" tip on iOS Safari. */
export function InstallHint() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    let wasDismissed = false;
    try {
      wasDismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // storage unavailable
    }
    // Reading browser-only APIs must happen after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(wasDismissed);
    setIos(isIosSafari());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (dismissed || (!prompt && !ios)) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 text-center text-xs font-extrabold text-screen-soft">
      {prompt ? (
        <button
          className="cursor-pointer underline decoration-2 underline-offset-2"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice;
            setPrompt(null);
          }}
        >
          Install Dotsnatch to play offline
        </button>
      ) : (
        <p>
          Tap <Share className="inline size-3.5 align-text-bottom" aria-label="Share" /> then Add to Home Screen to play
          offline
        </p>
      )}
      <button onClick={dismiss} aria-label="Dismiss install tip" className="cursor-pointer rounded-full p-1 hover:bg-black/5">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
