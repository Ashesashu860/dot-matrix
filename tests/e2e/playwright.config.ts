import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile',
      testIgnore: /online\.spec/,
      use: { ...devices['Pixel 7'] },
    },
    {
      // Needs the Firebase emulators and a web build with NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true.
      name: 'online',
      testMatch: /online\.spec/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `pnpm --filter @dots/web exec next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
