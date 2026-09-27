import { defineConfig } from 'vitest/config';

// Runs inside `firebase emulators:exec` (see root `pnpm test:emulators`).
export default defineConfig({
  test: {
    include: ['*.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
