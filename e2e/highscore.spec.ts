import { expect, test, type Page } from '@playwright/test';
import { nav, register, seed, uniqueName, watch } from './helpers.ts';

// The categories of the highscore (#422): Gesamt, Wirtschaft and Militär,
// one ranking each, chosen by a button above the table (D3 of #78); by
// number by default (167a). Other players of the suite share the universe,
// so the test compares the two players it makes.

/** The names of the players in the order of the highscore. */
const order = (page: Page): Promise<string[]> =>
  page.locator('.scores tr td:nth-child(2)').allTextContents();

test('the highscore ranks Gesamt, Wirtschaft and Militär each on its own (#422)', async ({
  page,
  browser,
}) => {
  const w = watch(page);
  const builder = uniqueName('Baumeister');
  const pilot = uniqueName('Flottenfuehrer');
  const other = await browser.newPage();
  await register(other, pilot);
  await other.close();
  await register(page, builder);
  // Mines of level 25 are worth about 3.8 million resources, but 25 levels;
  // 100 Spähschädel 100,000, but 100 ships.
  seed({ name: builder, b: { metal: 25 } });
  seed({ name: pilot, ships: { probe: 100 } });
  await page.reload();
  await nav(page, 'highscore');
  await expect(page.locator('.scores tr.me')).toContainText(builder);
  const total = await order(page);
  expect(total.indexOf(builder)).toBeLessThan(total.indexOf(pilot));
  await expect(page.getByRole('button', { name: 'Gesamt' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  // Only the three categories (160a).
  await expect(page.locator('[data-act=highscore]')).toHaveText([
    'Gesamt',
    'Wirtschaft',
    'Militär',
  ]);

  await page.getByRole('button', { name: 'Militär' }).click();
  await expect(page.getByRole('button', { name: 'Militär' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('.dim', { hasText: '1 Punkt' })).toHaveText(
    '1 Punkt pro Schiff, Verteidigungsanlage und Rakete.',
  );
  const military = await order(page);
  expect(military.indexOf(pilot)).toBeLessThan(military.indexOf(builder));
  await expect(
    page.locator('.scores tr', { hasText: pilot }).locator('td.n').last(),
  ).toHaveText('100');
  // The own row stays marked in every category.
  await expect(page.locator('.scores tr.me')).toContainText(builder);

  await page.getByRole('button', { name: 'Wirtschaft' }).click();
  await expect(page.locator('.dim', { hasText: '1 Punkt' })).toHaveText(
    '1 Punkt pro Gebäudestufe, Forschungsstufe und Sonnenreliquiar.',
  );
  const economy = await order(page);
  expect(economy.indexOf(builder)).toBeLessThan(economy.indexOf(pilot));
  await expect(page.locator('.scores tr.me td.n').last()).toHaveText('25');
  await expect(page.locator('.scores tr.me')).toContainText(builder);
  expect(w.problems).toEqual([]);
});
