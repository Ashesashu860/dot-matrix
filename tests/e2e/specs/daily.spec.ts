import { expect, test } from '@playwright/test';
import { claimedCount } from './helpers';

test('the daily puzzle can be played with a hint and records the attempt', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Daily Puzzle #\d+/ }).click();
  await expect(page.getByText(/Finish with \d+ of \d+ boxes/)).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /Start puzzle/ }).click();
  await expect(page.getByRole('group', { name: /Game board/ })).toBeVisible();

  await page.getByRole('button', { name: /Hint \(1 left\)/ }).click();
  const hinted = page.locator('[data-hint]');
  await expect(hinted).toHaveCount(1);
  const edge = await hinted.getAttribute('data-hint');
  await page.locator(`[data-edge="${edge}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-edge="${edge}"]`)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Hint/ })).toHaveCount(0);

  // Finish the game with whatever line is available on each of our turns.
  for (let i = 0; i < 80 && !(await page.getByRole('dialog').isVisible()); i++) {
    if ((await claimedCount(page)) > 0) {
      await page.locator('[data-edge]').first().focus().catch(() => {});
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(200);
  }
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog).toContainText(/Solved!|Not quite/);
  await page.screenshot({ path: 'test-results/daily-result.png' });

  await page.goto('/daily');
  await expect(page.getByText(/^1\/3$/)).toBeVisible();
  await expect(page.getByText(/^1\/1$/)).toBeVisible();
});
