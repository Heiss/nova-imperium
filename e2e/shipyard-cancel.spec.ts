// Cancelling an order of the shipyard (#258, okf/features/shipyard-cancel.md):
// every order of the box „Bauauftrag der Schiffsschmiede“ has a button
// „Abbrechen“ that removes the rest of that order at once (no question) and
// gives back the full cost of every unit not done yet; units that are done
// stay on the planet. Orders are made in the browser; the shipyard finishing a
// unit is moved forward with e2e/seed.ts.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { nav, register, seed, stock, uniqueName, watch } from './helpers.ts';
import { shipCount } from './fleet-helpers.ts';

/** The Adamant of the resource bar as a number. */
const adamant = async (page: Page): Promise<number> =>
  Number(
    ((await stock(page, 'Adamant').textContent()) ?? '').replace(/\./g, ''),
  );

/**
 * The stock is back at `expected`: the planet makes a few Adamant in the
 * seconds a test takes (no mines here), never fewer.
 */
function expectBack(actual: number, expected: number): void {
  expect(actual).toBeGreaterThanOrEqual(expected);
  expect(actual).toBeLessThanOrEqual(expected + 3);
}

/** The box of the orders and the button of one of them. */
const orders = (page: Page): Locator =>
  page.locator('.box').filter({
    has: page.locator('.hd', { hasText: 'Bauauftrag der Schiffsschmiede' }),
  });
const cancel = (page: Page, label: string): Locator =>
  page.getByRole('button', { name: `Abbrechen: ${label}`, exact: true });

/** Orders `n` units of a ship and waits for the order to stand in the box. */
async function order(page: Page, key: string, n: number): Promise<void> {
  await page.fill(`#q_${key}`, String(n));
  await page.click(`[data-act=order][data-k=${key}]`);
  await expect(page.locator('.toast').last()).toContainText(`${n}× `);
}

test.describe('cancelling a shipyard order (#258)', () => {
  test('a cancel gives back the cost of the units not done yet at once, the units done stay', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Abbruch');
    await register(page, name);
    seed({
      name,
      b: { yard: 3, robot: 2 },
      research: { comb: 3, spy: 2 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    await page.reload();
    await nav(page, 'shipyard');
    await expect(orders(page)).toHaveCount(0);
    const start = await adamant(page);

    // Two orders: 3 Abfangjäger and 2 Frachtläufer.
    await order(page, 'lf', 3);
    await expect(orders(page).getByRole('row')).toHaveCount(1);
    const afterFirst = await adamant(page);
    await order(page, 'sc', 2);
    await expect(orders(page).getByRole('row')).toHaveCount(2);
    const afterSecond = await adamant(page);
    expect(afterFirst).toBeLessThan(start);
    expect(afterSecond).toBeLessThan(afterFirst);

    // The later order goes, nobody asks, and its cost is back: no unit of it
    // was done.
    await cancel(page, '2× Frachtläufer').click();
    await expect(orders(page).getByRole('row')).toHaveCount(1);
    await expect(cancel(page, '2× Frachtläufer')).toHaveCount(0);
    expectBack(await adamant(page), afterFirst);

    // One Abfangjäger is built; the cancel takes the other two and gives back
    // their cost only (a third of the order is done and stays).
    const perUnit = (start - afterFirst) / 3;
    seed({ name, finishUnits: 1 });
    await expect(cancel(page, '2× Abfangjäger')).toBeVisible({
      timeout: 15000,
    });
    const before = await adamant(page);
    await cancel(page, '2× Abfangjäger').click();
    await expect(orders(page)).toHaveCount(0);
    expectBack(await adamant(page), before + 2 * perUnit);
    await nav(page, 'fleet');
    await expect(shipCount(page, 'Abfangjäger')).toHaveText('1');
    expect(w.problems).toEqual([]);
  });
});
