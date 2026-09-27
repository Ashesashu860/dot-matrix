import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const webFiles = ['apps/web/**/*.{ts,tsx}'];

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/lib/**',
    '**/dist/**',
    '**/coverage/**',
    'apps/web/next-env.d.ts',
    'apps/web/public/**',
    'playwright-report/**',
    'test-results/**',
  ]),
  {
    files: ['**/*.{ts,tsx,mjs,js}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  // Next.js rules only for the web app.
  ...[...nextVitals, ...nextTs].map((config) => ({ ...config, files: webFiles })),
  {
    files: webFiles,
    settings: { next: { rootDir: 'apps/web' } },
    languageOptions: { globals: { ...globals.browser } },
    // App Router only; there is no pages/ directory.
    rules: { '@next/next/no-html-link-for-pages': 'off' },
  },
  // The engine packages must stay framework- and platform-independent.
  {
    files: ['packages/game-engine/src/**', 'packages/cpu-engine/src/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['react', 'react-*', 'next', 'next/*', 'firebase', 'firebase/*', 'firebase-*'] },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'localStorage', 'indexedDB', 'navigator'],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Pass time in; the engine must be deterministic.' },
        { object: 'Math', property: 'random', message: 'Use the seeded Rng.' },
      ],
    },
  },
]);
