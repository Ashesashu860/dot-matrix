import { expect, test } from '@playwright/test';
import { claimedCount } from './helpers';

test('a shaped board with walls and gold plays to the end', async ({ page }) => {
  await page.goto('/play/setup?mode=local');
  await page.getByRole('radio', { name: /Vault board, 5 gold boxes/ }).click();
  await page.getByRole('button', { name: /Start Vault/ }).click();
  await expect(page.getByRole('heading', { name: 'Vault' })).toBeVisible();
  // 6×6 dots = 60 lines, 4 of them pre-drawn walls.
  await expect(page.locator('[data-edge]')).toHaveCount(56);
  await expect(page.locator('[data-edge="H-1-2"]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/shape-vault.png' });

  await page.locator('[data-edge]').first().focus();
  for (let i = 0; i < 70 && (await claimedCount(page)) > 0; i++) await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5000 });
  // 25 boxes, 5 of them gold: 30 points shared out.
  const scores = await dialog.getByRole('list', { name: 'Final scores' }).locator('li').allInnerTexts();
  const total = scores.map((t) => Number(t.trim().split(/\s+/).at(-1))).reduce((a, b) => a + b, 0);
  expect(total).toBe(30);
});

test('holes leave gaps in the board', async ({ page }) => {
  await page.goto('/play/setup?mode=local');
  await page.getByRole('radio', { name: /^Ring board/ }).click();
  await page.getByRole('button', { name: /Start Ring/ }).click();
  await expect(page.locator('[data-edge="H-3-2"]')).toHaveCount(0); // inside the hole
  await expect(page.locator('[data-edge="H-2-2"]')).toHaveCount(1); // the hole's rim
  await page.screenshot({ path: 'test-results/shape-ring.png' });
});
