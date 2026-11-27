// The Handelsposten while the marketplace is off (#442, owner, 2026-11-27,
// 226b, 227b, 278a): the admin switches „Marktplatz aktiv“ off in
// „Universum“. „Gebäude“ lists the Handelsposten only where it has a level:
// without a build button, with the refusal of the marketplace and with
// „Zurückbauen“; a player without one does not see it. Switched on again,
// it is back with its level. The market is shared by all players of the
// universe; the test puts the setting back.
import { type Browser, expect, test, type Page } from '@playwright/test';
import {
  cli,
  nav,
  openAllRows,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const CLOSED = 'Der Marktplatz ist in dieser Runde geschlossen.';

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

/** A player without a Handelsposten, in a second browser. */
async function newcomer(browser: Browser, page: Page) {
  const context = await browser.newContext({ viewport: page.viewportSize() });
  const other = await context.newPage();
  const name = uniqueName('Neuling');
  await register(other, name);
  seed({ name, b: { robot: 4 }, res: { m: 100000, c: 100000, d: 100000 } });
  return { context, other };
}

async function hiddenFlow(page: Page, browser: Browser): Promise<void> {
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
  const { context, other } = await newcomer(browser, page);
  const o = watch(other);
  await nav(page, 'buildings');
  await expect(tradingPost(page).locator('.lv')).toHaveText('(Stufe 2)');
  await nav(other, 'buildings');
  await expect(tradingPost(other)).toHaveCount(1);
  try {
    await switchMarket(page, '0');
    // With a level: the row, the refusal instead of the button, „Zurückbauen“.
    await nav(page, 'buildings');
    await openAllRows(page);
    const row = tradingPost(page);
    await expect(row.locator('.lv')).toHaveText('(Stufe 2)');
    await expect(row).toContainText(CLOSED);
    await expect(
      row.getByRole('button', { name: /^(Bauen|Ausbauen)/ }),
    ).toHaveCount(0);
    await expect(
      row.getByRole('button', { name: 'Zurückbauen' }),
    ).toBeVisible();
    // No „?“: its article is hidden while the marketplace is off.
    await expect(page.locator('#exq_market')).toHaveCount(0);
    await expect(page.locator('#exq_robot')).toHaveCount(1);
    // Without one: no row.
    await other.reload();
    await nav(other, 'buildings');
    await expect(other.locator('.item').first()).toBeVisible();
    await expect(tradingPost(other)).toHaveCount(0);
  } finally {
    await switchMarket(page, '1');
  }
  await nav(page, 'buildings');
  await expect(tradingPost(page).locator('.lv')).toHaveText('(Stufe 2)');
  await expect(tradingPost(page)).not.toContainText(CLOSED);
  await expect(page.locator('#exq_market')).toHaveCount(1);
  await other.reload();
  await nav(other, 'buildings');
  await expect(tradingPost(other)).toHaveCount(1);
  cli('unadmin', name);
  await context.close();
  expect(w.problems).toEqual([]);
  expect(o.problems).toEqual([]);
}

test('the Handelsposten shows only where it stands while the marketplace is off, and is back with its level (#442)', async ({
  page,
  browser,
}) => {
  await hiddenFlow(page, browser);
});

test('the Handelsposten while the marketplace is off, on a phone (#442) @phone', async ({
  page,
  browser,
}) => {
  await hiddenFlow(page, browser);
});
