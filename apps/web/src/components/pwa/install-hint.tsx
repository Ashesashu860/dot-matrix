'use client';

import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

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
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-3 text-sm shadow-sm">
      <Download className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-medium">Install Dots Matrix</p>
        {prompt ? (
          <p className="text-muted-foreground">Play offline from your home screen.</p>
        ) : (
          <p className="text-muted-foreground">
            Tap <Share className="inline size-4 align-text-bottom" aria-label="Share" /> then{' '}
            <strong>Add to Home Screen</strong> to play offline.
          </p>
        )}
        {prompt && (
          <Button
            size="sm"
            className="mt-2"
            onClick={async () => {
              await prompt.prompt();
              await prompt.userChoice;
              setPrompt(null);
            }}
          >
            Install
          </Button>
        )}
      </div>
      <button onClick={dismiss} aria-label="Dismiss install tip" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
        <X className="size-4" />
      </button>
    </div>
  );
}
