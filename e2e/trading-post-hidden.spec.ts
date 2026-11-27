// The Handelsposten while the marketplace is off (#442, owner, 2026-11-27,
// 226b, 227b): the admin switches „Marktplatz aktiv“ off in „Universum“,
// and „Gebäude“ no longer lists the Handelsposten; switched on again, it is
// back with its level. The market is shared by all players of the universe;
// the test puts the setting back.
import { expect, test, type Page } from '@playwright/test';
import { cli, nav, register, seed, uniqueName, watch } from './helpers.ts';

/** The admin sets „Marktplatz aktiv“ in „Universum“ and saves. */
async function switchMarket(page: Page, on: '0' | '1'): Promise<void> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page.getByLabel('Marktplatz aktiv', { exact: true }).selectOption(on);
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Einstellungen gespeichert.',
  );
}

/** The row of the Handelsposten in the list „Gebäude“. */
const tradingPost = (page: Page) =>
  page.locator('.item').filter({ hasText: 'Handelsposten' });

test('the Handelsposten is not offered while the marketplace is off, and is back with its level (#442)', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Posten');
  await register(page, name);
  cli('admin', name);
  seed({
    name,
    b: { robot: 4, market: 2 },
    res: { m: 100000, c: 100000, d: 100000 },
  });
  await page.reload();
  await nav(page, 'buildings');
  await expect(tradingPost(page)).toHaveCount(1);
  await expect(tradingPost(page).locator('.lv')).toHaveText('(Stufe 2)');
  try {
    await switchMarket(page, '0');
    await nav(page, 'buildings');
    await expect(page.locator('.item').first()).toBeVisible();
    await expect(tradingPost(page)).toHaveCount(0);
  } finally {
    await switchMarket(page, '1');
  }
  await nav(page, 'buildings');
  await expect(tradingPost(page)).toHaveCount(1);
  await expect(tradingPost(page).locator('.lv')).toHaveText('(Stufe 2)');
  cli('unadmin', name);
  expect(w.problems).toEqual([]);
});
