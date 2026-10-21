import { expect, test } from '@playwright/test';
import { createProfile, tapEdge } from './helpers';

test('the campaign opens on stage 1-1 and plays it with its goals shown', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Campaign.*Create a profile/ }).click();
  await expect(page.getByRole('button', { name: /Play stage/ })).toHaveCount(0);
  await createProfile(page);
  await expect(page.getByRole('region', { name: /Chapter 1: First Lines/ })).toBeVisible();
  await expect(page.getByRole('listitem', { name: /^Stage 1-1, 0 stars/ })).toBeEnabled();
  await expect(page.getByRole('listitem', { name: 'Stage 1-2, locked' })).toBeDisabled();
  await page.screenshot({ path: 'test-results/campaign.png', fullPage: true });

  await page.getByRole('button', { name: /Play stage 1-1/ }).click();
  await expect(page.getByRole('heading', { name: 'Stage 1-1' })).toBeVisible();
  await expect(page.getByText(/Win by 3\+/)).toBeVisible();
  await expect(page.getByText('Ada', { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-edge]')).toHaveCount(24);
  await tapEdge(page, 'H-0-0');
  await expect.poll(() => page.locator('[data-edge]').count(), { timeout: 15000 }).toBeLessThanOrEqual(22);

  // The stage resumes from Home.
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Resume game.*Stage 1-1/ })).toBeVisible();
});

test('a finished stage shows its goals and an endgame review', async ({ page }) => {
  await createProfile(page);
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

test('profiles keep their own stars and can be reset', async ({ page }) => {
  await createProfile(page, 'Ada');
  // Give Ada some stars directly, then reload so the app reads them.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('dots-matrix');
        open.onsuccess = () => {
          const store = open.result.transaction('kv', 'readwrite').objectStore('kv');
          const get = store.get('profiles');
          get.onsuccess = () => {
            const book = get.result;
            book.profiles[0].campaign = { stars: { '1-1': 3, '1-2': 2 }, grantedChapter: 1 };
            store.put(book, 'profiles').onsuccess = () => resolve();
          };
        };
        open.onerror = () => reject(open.error);
      }),
  );
  await page.goto('/profiles');
  const ada = page.getByRole('region', { name: 'Profile Ada' });
  await expect(ada.getByText(/5 \/ \d+ · Stage 1-3/)).toBeVisible();

  await page.getByRole('button', { name: '+ Add profile' }).click();
  await page.getByLabel('Name').fill('ada');
  await expect(page.getByText('A profile called ada already exists.')).toBeVisible();
  await page.getByLabel('Name').fill('Bo');
  await page.getByRole('button', { name: 'Create profile' }).click();
  const bo = page.getByRole('region', { name: 'Profile Bo' });
  await expect(bo.getByText('PLAYING')).toBeVisible();
  await expect(bo.getByText(/0 \/ \d+ · Not started/)).toBeVisible();

  await page.goto('/campaign');
  await expect(page.getByRole('link', { name: /Playing as Bo, 0 stars/ })).toBeVisible();
  await page.goto('/profiles');
  await ada.getByRole('button', { name: 'Switch' }).click();
  await expect(ada.getByText('PLAYING')).toBeVisible();

  await ada.getByRole('button', { name: 'Reset progress' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset progress' }).click();
  await expect(ada.getByText(/0 \/ \d+ · Not started/)).toBeVisible();
  await page.screenshot({ path: 'test-results/profiles.png', fullPage: true });

  await page.reload();
  await expect(page.getByRole('region', { name: 'Profile Ada' }).getByText(/Not started/)).toBeVisible();
  await bo.getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete profile' }).click();
  await expect(bo).toHaveCount(0);
});
