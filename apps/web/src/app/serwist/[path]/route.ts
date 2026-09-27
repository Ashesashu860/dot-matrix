import { spawnSync } from 'node:child_process';
import { createSerwistRoute } from '@serwist/turbopack';

// Changes every build/commit so precached pages refresh after an update.
const git = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' });
const revision = (git.status === 0 && git.stdout.trim()) || process.env.BUILD_REVISION || `${Date.now()}`;

/** App-shell routes precached so CPU and local play work fully offline. */
const OFFLINE_ROUTES = ['/', '/play/setup', '/play', '/how-to-play', '/settings', '/stats', '/online', '/online/room', '/~offline'];

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } = createSerwistRoute({
  additionalPrecacheEntries: OFFLINE_ROUTES.map((url) => ({ url, revision })),
  swSrc: 'src/sw.ts',
  useNativeEsbuild: true,
});
