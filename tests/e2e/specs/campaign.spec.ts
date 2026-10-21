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
