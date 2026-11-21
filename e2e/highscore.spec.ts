import { expect, test, type Page } from '@playwright/test';
import { nav, register, seed, uniqueName, watch } from './helpers.ts';

// The categories of the highscore (#78): one ranking each, chosen by a button
// above the table (D3); fleet counts ships, buildings 1 point per 1,000
// resources (Q1, D5). Other players of the suite share the universe, so the
// test compares the two players it makes.

/** The names of the players in the order of the highscore. */
const order = (page: Page): Promise<string[]> =>
  page.locator('.scores tr td:nth-child(2)').allTextContents();

test('the highscore ranks each category on its own (#78)', async ({
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
  // Mines of level 25 are worth about 3.8 million resources; 100
  // Spähschädel 100,000, but 100 ships.
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

  await page.getByRole('button', { name: 'Flotte' }).click();
  await expect(page.getByRole('button', { name: 'Flotte' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const fleet = await order(page);
  expect(fleet.indexOf(pilot)).toBeLessThan(fleet.indexOf(builder));
  await expect(
    page.locator('.scores tr', { hasText: pilot }).locator('td.n').last(),
  ).toHaveText('100');
  // The own row stays marked in every category.
  await expect(page.locator('.scores tr.me')).toContainText(builder);

  await page.getByRole('button', { name: 'Gebäude' }).click();
  await expect(page.locator('.dim', { hasText: '1 Punkt' })).toHaveText(
    '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude).',
  );
  const buildings = await order(page);
  expect(buildings.indexOf(builder)).toBeLessThan(buildings.indexOf(pilot));
  await expect(page.locator('.scores tr.me')).toContainText(builder);
  expect(w.problems).toEqual([]);
});
