# Local development

## Prerequisites

- Node 22+ with pnpm (`corepack enable pnpm`)
- For online play and Firebase tests: Java 21+ and the Firebase CLI (`npm i -g firebase-tools`)

## Everyday workflow

```bash
pnpm install
pnpm dev        # http://localhost:3000 — CPU and local modes, no backend
pnpm dev:all    # builds functions, starts emulators + the web app
```

`apps/web/.env.development` sets `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true`, so `next dev` talks to:

| Emulator | Port |
| --- | --- |
| Auth | 9099 |
| Firestore | 8080 |
| Realtime Database | 9000 (namespace `demo-dots-matrix`) |
| Functions | 5001 |
| Emulator UI | 4000 — inspect rooms, games, moves, presence |

The project ID is `demo-dots-matrix`. The `demo-` prefix means nothing ever reaches real Google Cloud.

After changing `functions/src`, rebuild with `pnpm --filter @dots/functions build`. The emulator picks up the new bundle in `functions/dist` automatically.

**Emulator-only settings** live in `functions/.env.demo-dots-matrix`:
- App Check is off.
- The presence grace period is 2 s, so tests are fast. The client still waits 60 s before claiming inactivity.

## Testing online play on a phone

1. Make the emulators listen on your LAN. Add `"host": "0.0.0.0"` to each emulator in `firebase.json`, locally only.
2. Run `pnpm dev:all` and open `http://<your-computer-ip>:3000` on the phone.
3. The client connects to the emulators on the same hostname as the page (override with `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST`).

## Tests

```bash
pnpm test              # unit tests (engine, CPU, protocol, web, functions)
pnpm test:emulators    # security rules + callable/trigger integration tests
pnpm build && pnpm e2e # Playwright: mobile gameplay, keyboard, CPU, resume, offline PWA, axe
pnpm e2e:online        # builds web against emulators; two-browser online game + reconnect
```

Playwright reuses a server already running on port 3100. Stop any stale `next start` first, otherwise you'll be testing an old build.

## PWA notes

- The service worker is disabled in `next dev`. Test offline behaviour with `pnpm build && pnpm --filter @dots/web start`.
- In Chrome DevTools, use Application → Service Workers and Network → Offline.
- Updates show an "Update available" toast. The new version activates only when the user accepts and no local game is in progress.
