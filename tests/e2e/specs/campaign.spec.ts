import { expect, test } from '@playwright/test';
import { tapEdge } from './helpers';

test('the campaign opens on stage 1-1 and plays it with its goals shown', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Campaign/ }).click();
  await expect(page.getByRole('region', { name: /Chapter 1: First Lines/ })).toBeVisible();
  await expect(page.getByRole('listitem', { name: /^Stage 1-1, 0 stars/ })).toBeEnabled();
  await expect(page.getByRole('listitem', { name: 'Stage 1-2, locked' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/campaign.png', fullPage: true });

  await page.getByRole('button', { name: /Play stage 1-1/ }).click();
  await expect(page.getByRole('heading', { name: 'Stage 1-1' })).toBeVisible();
  await expect(page.getByText(/Win by 3\+/)).toBeVisible();
  await expect(page.locator('[data-edge]')).toHaveCount(24);
  await tapEdge(page, 'H-0-0');
  await expect.poll(() => page.locator('[data-edge]').count(), { timeout: 15000 }).toBeLessThanOrEqual(22);

  // The stage resumes from Home.
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Resume game.*Stage 1-1/ })).toBeVisible();
});

test('a finished stage shows its goals and an endgame review', async ({ page }) => {
  await page.goto('/campaign');
  await page.getByRole('button', { name: /Play stage 1-1/ }).click();
  await expect(page.locator('[data-edge]')).toHaveCount(24);
  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 60 && !(await dialog.isVisible()); i++) {
    if ((await page.locator('[data-edge]').count()) > 0) {
      await page.locator('[data-edge]').first().focus().catch(() => {});
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(200);
  }
  await expect(dialog.getByRole('list', { name: 'Goals' })).toBeVisible({ timeout: 15000 });
  await expect(dialog.getByText(/Turning point|Endgame review/)).toBeVisible({ timeout: 15000 });
  const showMe = dialog.getByRole('button', { name: 'Show me' });
  if (await showMe.isVisible()) {
    await showMe.click();
    await expect(dialog.locator('[data-hint]')).toHaveCount(1);
  }
  await page.screenshot({ path: 'test-results/campaign-result.png', fullPage: true });
});
