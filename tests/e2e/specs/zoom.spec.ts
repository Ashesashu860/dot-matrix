import { expect, test } from '@playwright/test';
import { claimedCount, startLocalGame, tapEdge } from './helpers';

test('two fingers pinch-zoom the board without drawing; fit resets it', async ({ page }) => {
  await startLocalGame(page, 2, 8);
  await expect(page.getByText('11×9 ·')).toBeVisible();
  await expect(page.getByText('Pinch to zoom')).toBeVisible();
  const before = await claimedCount(page);
  const svg = page.getByRole('group', { name: /Game board/ });
  const b = (await svg.boundingBox())!;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: string, pts: Array<[number, number]>) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  // Spread two fingers apart from the middle of the board.
  await touch('touchStart', [[cx - 20, cy], [cx + 20, cy]]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [[cx - 20 - i * 8, cy], [cx + 20 + i * 8, cy]]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  const after = (await svg.boundingBox())!;
  expect(after.width).toBeGreaterThan(b.width * 2);
  expect(after.width).toBeLessThanOrEqual(b.width * 3 + 1);
  expect(await claimedCount(page)).toBe(before);
  await expect(page.getByText('Pinch to zoom')).toHaveCount(0);

  // One finger still draws while zoomed, hitting the line under it.
  const visible = await page.locator('[data-edge]').evaluateAll((els) =>
    els
      .map((e) => ({ id: e.getAttribute('data-edge')!, r: e.getBoundingClientRect() }))
      .filter(({ r }) => {
        const x = r.x + r.width / 2;
        const y = r.y + r.height / 2;
        return x > innerWidth * 0.25 && x < innerWidth * 0.75 && y > innerHeight * 0.3 && y < innerHeight * 0.6;
      })
      .map((v) => v.id),
  );
  await tapEdge(page, visible[0]!, { x: 0, y: 0 });
  await expect(page.locator(`[data-edge="${visible[0]}"]`)).toHaveCount(0);

  await page.getByRole('button', { name: 'Fit board to screen' }).click();
  const reset = (await svg.boundingBox())!;
  expect(Math.round(reset.width)).toBe(Math.round(b.width));
});
