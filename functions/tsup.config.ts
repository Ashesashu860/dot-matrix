import { defineConfig } from 'tsup';

// Bundle workspace packages (game engine, protocol) into the output so the
// deployed functions only depend on real npm packages.
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['cjs'],
  target: 'node22',
  platform: 'node',
  // Never let tsup clean: dist/node_modules is a symlink and its glob-based
  // clean follows it. scripts/clean.mjs removes dist without following links.
  clean: false,
  sourcemap: true,
  noExternal: [/^@dots\//],
  external: ['firebase-admin', 'firebase-functions', 'zod'],
});
