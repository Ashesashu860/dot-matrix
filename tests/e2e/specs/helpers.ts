import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Tap near (not exactly on) an edge, as a finger would. */
export async function tapEdge(page: Page, edgeId: string, offset = { x: 6, y: 9 }) {
  const box = await page.locator(`[data-edge="${edgeId}"]`).boundingBox();
  if (!box) throw new Error(`edge ${edgeId} not found`);
  await page.touchscreen.tap(box.x + box.width / 2 + offset.x, box.y + box.height / 2 + offset.y);
}

export async function claimedCount(page: Page) {
  // Available edges render as focusable buttons; claimed ones disappear.
  return page.locator('[data-edge]').count();
}

export async function startLocalGame(page: Page, players = 2, level = 1) {
  await page.goto('/play/setup?mode=local');
  await page.getByRole('radio', { name: `${players} players` }).click();
  await page.getByRole('radio', { name: new RegExp(`^Level ${level},`) }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.getByRole('group', { name: /Game board/ })).toBeVisible();
}
