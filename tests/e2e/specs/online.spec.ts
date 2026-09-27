import { devices, expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

// Requires: Firebase emulators running and the web app built with
// NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true (see root `pnpm e2e:online`).

async function newPlayerPage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ ...devices['Pixel 7'], baseURL });
  const page = await context.newPage();
  return { context, page };
}

async function setName(page: Page, name: string) {
  await page.goto('/online');
  const input = page.getByLabel('Your name');
  await expect(input).toBeVisible();
  await input.fill(name);
}

async function createRoom(page: Page) {
  await setName(page, 'Host');
  await page.getByRole('tab', { name: 'Create a room' }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
  await page.waitForURL(/\/online\/room\?id=/);
  const label = await page.getByLabel(/^Room code/).getAttribute('aria-label');
  return label!.replace('Room code ', '').replace(/ /g, '');
}

async function joinRoom(page: Page, code: string) {
  await setName(page, 'Guest');
  await page.getByLabel('Room code').fill(code);
  await page.getByRole('button', { name: 'Join' }).click();
  await page.waitForURL(/\/online\/room\?id=/);
}

async function startGame(host: Page, guest: Page) {
  await guest.getByRole('button', { name: 'Ready?' }).click();
  await expect(host.getByRole('button', { name: /Start match/ })).toBeEnabled({ timeout: 10_000 });
  await host.getByRole('button', { name: /Start match/ }).click();
  for (const p of [host, guest]) await expect(p.getByRole('group', { name: /Game board/ })).toBeVisible({ timeout: 10_000 });
}

const edgesLeft = (p: Page) => p.locator('[data-edge]').count();

test('two players create, join and finish an online game with real-time updates', async ({ browser, baseURL }) => {
  const a = await newPlayerPage(browser, baseURL!);
  const b = await newPlayerPage(browser, baseURL!);
  const code = await createRoom(a.page);
  expect(code).toMatch(/^[2-9A-Z]{6}$/);
  await joinRoom(b.page, code);
  // Host sees the guest arrive in real time.
  await expect(a.page.getByText('Guest')).toBeVisible();
  await startGame(a.page, b.page);

  for (let move = 0; move < 24; move++) {
    const before = await edgesLeft(a.page);
    if (before === 0) break;
    // The scoreboard marks the current player with aria-current; "(you)" marks this device.
    const myTurn = (p: Page) => p.locator('li[aria-current="true"]', { hasText: '(you)' }).count();
    const mover = (await myTurn(a.page)) === 1 ? a.page : b.page;
    await expect.poll(() => myTurn(mover)).toBe(1);
    await mover.locator('[data-edge]').first().focus();
    await mover.keyboard.press('Enter');
    // Both screens receive the authoritative update.
    await expect.poll(() => edgesLeft(a.page), { timeout: 10_000 }).toBe(before - 1);
    await expect.poll(() => edgesLeft(b.page), { timeout: 10_000 }).toBe(before - 1);
  }

  for (const p of [a.page, b.page]) {
    await expect(p.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(p.getByRole('dialog')).toContainText(/win|draw/i);
  }
  await a.page.screenshot({ path: 'test-results/online-result.png' });
  await a.context.close();
  await b.context.close();
});

test('a disconnected player is shown as offline and can reconnect to the same game', async ({ browser, baseURL }) => {
  const a = await newPlayerPage(browser, baseURL!);
  const b = await newPlayerPage(browser, baseURL!);
  const code = await createRoom(a.page);
  await joinRoom(b.page, code);
  await startGame(a.page, b.page);

  // Host moves first.
  await a.page.locator('[data-edge]').first().focus();
  await a.page.keyboard.press('Enter');
  await expect.poll(() => edgesLeft(b.page)).toBe(23);

  // Guest's tab closes: RTDB onDisconnect marks them offline for everyone.
  await b.page.close();
  await expect(a.page.getByLabel('disconnected')).toBeVisible({ timeout: 15_000 });

  // Same browser profile (same anonymous UID) comes back and rejoins.
  const again = await b.context.newPage();
  await again.goto('/online');
  await again.getByRole('button', { name: 'Rejoin your game' }).click();
  await expect(again.getByRole('group', { name: /Game board/ })).toBeVisible({ timeout: 10_000 });
  await expect.poll(() => edgesLeft(again)).toBe(23);
  await expect(again.getByText('Your turn')).toBeVisible();
  await expect(a.page.getByLabel('disconnected')).toHaveCount(0, { timeout: 15_000 });

  await a.context.close();
  await b.context.close();
});
