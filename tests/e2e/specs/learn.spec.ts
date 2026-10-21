import { expect, test } from '@playwright/test';

test('lesson 1 is completed by following the hints, and is marked done', async ({ page }) => {
  await page.goto('/how-to-play');
  await page.getByRole('link', { name: /Learn chains in 5 lessons/ }).click();
  await expect(page.getByText('Lesson 1: Take free boxes')).toBeVisible();
  await page.getByRole('button', { name: /Play lesson 1/ }).click();
  await expect(page.getByRole('group', { name: /Game board/ })).toBeVisible();

  const dialog = page.getByRole('dialog');
  for (let i = 0; i < 40 && !(await dialog.isVisible()); i++) {
    const showMe = page.getByRole('button', { name: 'Show me' });
    if (await showMe.isVisible()) {
      await showMe.click();
      const hint = page.locator('[data-hint]');
      await hint.waitFor({ state: 'attached', timeout: 5000 });
      const edge = await hint.getAttribute('data-hint');
      await page.locator(`[data-edge="${edge}"]`).focus();
      await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(250);
  }
  await expect(dialog).toContainText('Lesson complete!', { timeout: 15000 });
  await dialog.getByRole('button', { name: /Next level/ }).click();
  await expect(page.getByRole('heading', { name: 'Lesson 2' })).toBeVisible();

  await page.goto('/learn');
  await expect(page.getByRole('button', { name: /Take free boxes.*Done/ })).toBeVisible();
});
