# Dotsnatch

**Connect. Capture. Conquer.** A mobile-first dots-and-boxes strategy game: play the CPU, pass-and-play with 2–4 friends on one device, or play online with a room code. It is an installable PWA, and CPU and local games work fully offline.

- **Frontend:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Zustand · Motion · SVG board · Serwist service worker · IndexedDB
- **Backend (online only):** Firebase Auth (anonymous) · Cloud Firestore · Cloud Functions v2 · Realtime Database presence · Security Rules · App Check · Emulator Suite
- **Core:** a framework-independent, deterministic game engine shared by the UI, CPU, server and tests

## Quick start

```bash
corepack enable pnpm          # or: corepack enable pnpm --install-directory ~/.local/bin
pnpm install

pnpm dev                      # CPU + local play at http://localhost:3000 (no Firebase needed)
pnpm dev:all                  # + Firebase emulators for online play (Emulator UI at :4000)
```

Online play in development uses the local **Firebase Emulator Suite**, which needs Java 21+ and the Firebase CLI. No cloud project or billing is required. See [docs/dev.md](docs/dev.md).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` / `pnpm dev:all` | Web app / web app + emulators |
| `pnpm lint` · `pnpm typecheck` | ESLint · strict TypeScript across all packages |
| `pnpm test` | Unit tests: engine, CPU, protocol, web helpers/controllers, functions |
| `pnpm test:emulators` | Security Rules + Cloud Functions integration tests against the emulators |
| `pnpm build` | Production build (web + functions bundle) |
| `pnpm e2e` | Playwright on a mobile viewport: gameplay, keyboard, resume, CPU, offline PWA, axe a11y |
| `pnpm e2e:online` | Two-browser online game + disconnect/reconnect against the emulators |

## Repository

```
apps/web/              Next.js app (UI, SVG board, controllers, PWA, IndexedDB, Firebase client)
packages/game-engine/  Pure rules: board, moves, scoring, turns, winner, replay, stats
packages/cpu-engine/   Easy / Medium / Hard strategies (chain analysis, exact endgame search)
packages/protocol/     Shared zod schemas, Firestore document types, error codes
functions/             Cloud Functions (authoritative online commands), bundled with tsup
firebase/              Firestore + RTDB security rules, indexes
tests/emulator/        Rules and functions integration tests
tests/e2e/             Playwright specs
docs/                  Architecture, dev workflow, Firebase deployment, acceptance checklist
```

Read [docs/architecture.md](docs/architecture.md) for how it fits together, and [docs/firebase.md](docs/firebase.md) to deploy.
