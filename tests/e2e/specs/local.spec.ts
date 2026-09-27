import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { claimedCount, startLocalGame, tapEdge } from './helpers';

test('home offers every mode without an account', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dots Matrix' })).toBeVisible();
  for (const name of ['Play vs CPU', 'Local Game', 'Online Game']) {
    await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible();
  }
  await page.screenshot({ path: 'test-results/home.png', fullPage: true });
});

test('a full local game can be played with taps and ends with results', async ({ page }) => {
  await startLocalGame(page, 2, 1);
  await expect(page.locator('[data-edge]')).toHaveCount(24);

  // Imprecise tap selects the nearby edge.
  await tapEdge(page, 'H-0-0');
  await expect(page.locator('[data-edge]')).toHaveCount(23);
  await expect(page.locator('[data-edge="H-0-0"]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/game-start.png' });

  // Finish with the keyboard: Enter draws the focused line, focus then moves on.
  await page.locator('[data-edge]').first().focus();
  for (let i = 0; i < 30 && (await claimedCount(page)) > 0; i++) {
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('dialog')).toContainText(/wins|draw/i);
  await expect(page.getByRole('dialog')).toContainText('Moves');
  await page.screenshot({ path: 'test-results/game-result.png' });
});

test('keyboard arrows move focus between available lines', async ({ page }) => {
  await startLocalGame(page, 3, 1);
  await page.locator('[data-edge]').first().focus();
  const first = await page.evaluate(() => document.activeElement?.getAttribute('data-edge'));
  await page.keyboard.press('ArrowRight');
  const second = await page.evaluate(() => document.activeElement?.getAttribute('data-edge'));
  expect(first).toBe('H-0-0');
  expect(second).toBe('H-0-1');
});

test('an interrupted local game resumes after reload', async ({ page }) => {
  await startLocalGame(page, 2, 2);
  await tapEdge(page, 'H-0-0');
  await tapEdge(page, 'V-1-1');
  await expect(page.locator('[data-edge]')).toHaveCount(38);
  await page.reload();
  await expect(page.locator('[data-edge]')).toHaveCount(38);
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Resume game/ })).toBeVisible();
});

test('the CPU replies to the human', async ({ page }) => {
  await page.goto('/play/setup?mode=cpu');
  await page.getByRole('radio', { name: 'Easy' }).click();
  await page.getByRole('button', { name: 'Start game' }).click();
  await expect(page.locator('[data-edge]')).toHaveCount(24);
  await tapEdge(page, 'H-0-0');
  // One human move plus at least one CPU move.
  await expect.poll(() => claimedCount(page), { timeout: 15000 }).toBeLessThanOrEqual(22);
  await expect(page.getByText('Your turn')).toBeVisible();
});

test('pause menu pauses and resumes', async ({ page }) => {
  await startLocalGame(page);
  await page.getByRole('button', { name: 'Pause menu' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('no serious accessibility violations on home, setup and game', async ({ page }) => {
  for (const url of ['/', '/play/setup?mode=local', '/how-to-play', '/settings']) {
    await page.goto(url);
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious, `${url}: ${serious.map((v) => v.id).join(', ')}`).toEqual([]);
  }
  await startLocalGame(page);
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, serious.map((v) => `${v.id}: ${v.nodes[0]?.html}`).join('\n')).toEqual([]);
});
