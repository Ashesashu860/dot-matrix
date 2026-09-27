import { expect, test } from '@playwright/test';
import { tapEdge } from './helpers';

test('after the service worker installs, local games work with no network', async ({ page, context }) => {
  await page.goto('/');
  // Wait for the service worker to install and precache the app shell.
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

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dots Matrix' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  // Navigate the way a user would: offline client navigation falls back to the precached page.
  await page.getByRole('link', { name: /Local Game/ }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('group', { name: /Game board/ })).toBeVisible();
  await tapEdge(page, 'H-0-0');
  await expect(page.locator('[data-edge]')).toHaveCount(23);
  await context.setOffline(false);
});
