import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { claimedCount, tapEdge } from './helpers';

/** Waits for the service worker to install and precache the app shell. */
async function waitForPrecache(page: Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return reg.active?.state;
  });
  await page.waitForFunction(async () => {
    const keys = await caches.keys();
    for (const key of keys) {
      const cache = await caches.open(key);
      if ((await cache.keys()).some((r) => new URL(r.url).pathname === '/play/setup')) return true;
    }
    return false;
  });
}

test('after the service worker installs, local games work with no network', async ({ page, context }) => {
  await waitForPrecache(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Box Hunt' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Navigate the way a user would: offline client navigation falls back to the precached page.
  await page.getByRole('link', { name: /Local Game/ }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('group', { name: /Game board/ })).toBeVisible();
  await tapEdge(page, 'H-0-0');
  await expect(page.locator('[data-edge]')).toHaveCount(23);
  await context.setOffline(false);
});

test('the CPU worker runs from the service worker cache while offline', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await waitForPrecache(page);

  await context.setOffline(true);
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.getByRole('link', { name: /Play vs CPU/ }).click();
  await page.getByRole('radio', { name: 'Easy' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('[data-edge]')).toHaveCount(24);
  await tapEdge(page, 'H-0-0');
  // One human move plus at least one CPU move.
  await expect.poll(() => claimedCount(page), { timeout: 15000 }).toBeLessThanOrEqual(22);
  expect(errors.filter((e) => e.includes('worker bootstrap'))).toEqual([]);
  await context.setOffline(false);
});
