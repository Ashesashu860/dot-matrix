# Acceptance criteria (requirements §14.2)

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Start CPU or local play without an account | ✅ | e2e `home offers every mode without an account`; Firebase is loaded only by `/online` routes |
| 2 | Choose 2–4 players and a supported board size | ✅ | Setup screen (levels 1–8 + custom 3–12 dots); e2e plays 2- and 3-player games |
| 3 | Only adjacent horizontal/vertical connections | ✅ | `game-engine` tests: diagonal, long, identical, off-board, malformed IDs |
| 4 | A completed cell gives exactly one point to the mover | ✅ | Engine test `completes a single cell and awards it to the mover` |
| 5 | One move can claim two neighbouring cells | ✅ | Engine test `completes two neighbouring cells with one edge` |
| 6 | Extra turn after a capture by default (configurable) | ✅ | Engine tests for extra turn on/off; setup and online rule switch |
| 7 | The last cell ends the match before another turn | ✅ | Engine test `ends immediately on the final cell without creating another turn` |
| 8 | CPU Easy/Medium/Hard make legal moves and never corrupt state | ✅ | `cpu-engine` full-game playouts (2–4 players, several sizes); state-immutability check; Hard > 85% vs Easy |
| 9 | Create/join a private room with real-time lobby and game | ✅ | Emulator tests (rooms); e2e `two players create, join and finish an online game` |
| 10 | Every online move validated server-side and committed atomically | ✅ | `submitMove` transaction; emulator tests for wrong turn, invalid edge, stale seq, non-member |
| 11 | Simultaneous same-edge requests can't double-score or corrupt the turn | ✅ | Emulator test: three concurrent requests → exactly one accepted, one move doc, turn intact |
| 12 | Reconnect and recover the authoritative game | ✅ | Emulator `reconnectPlayer` test; e2e disconnect → offline badge → rejoin with same state |
| 13 | Installed PWA launches CPU/local games offline | ✅ | e2e `after the service worker installs, local games work with no network` |
| 14 | Settings, level progress and history persist | ✅ | IndexedDB repositories; e2e resume-after-reload; stats and history screens |
| 15 | Accessibility and responsive requirements | ✅ | Keyboard edge navigation, ARIA labels, live announcements, shape cues, reduced motion; axe finds no serious/critical issues; Pixel 7 viewport |
| 16 | Automated tests pass and the production build succeeds | ✅ (locally) | lint, typecheck, unit, emulator, build and e2e all green. **Deploying to real Firebase is pending** until staging/production projects exist (see `firebase.md`) |

## Still manual

- Check touch play on real small phones (iOS Safari and Android Chrome). Automated coverage uses Playwright device emulation.
- Try iOS "Add to Home Screen" and offline launch on a real device.
- Create the real Firebase projects, enable App Check, and deploy.
