// The game flows of #68 that had no browser test, and the admin event log of
// a battle (#151). Flights and the shipyard
// are moved forward with e2e/seed.ts; the mails go through the mail sink of
// the second server (e2e/env.ts, e2e/mail.ts).
import { expect, test } from '@playwright/test';
import {
  expectShownPlace,
  register,
  seed,
  shownPlace,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('galaxy, shipyard and options (#68)', () => {
  test('galaxy: ◀ ▶ step through galaxies and systems, Enter shows a typed system, „zum Heimatsystem“ and „Wechseln“', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Karte');
    await register(page, name);
    seed({ name, colony: {} });
    // A second colony far away shows that Enter loads the typed system.
    const far = uniqueName('Fern');
    seed({ name, colony: { g: 2, s: 7, p: 15, name: far } });
    const farRow = page.locator('table.gal tr', { hasText: far });
    await page.goto('/?view=galaxy');
    await expect(shownPlace(page)).toHaveText(/\[\d+:\d+:\d+\]$/);
    const [, g, s] = /\[(\d+):(\d+):\d+\]/.exec(
      (await shownPlace(page).textContent())!,
    )!;
    const gal = page.getByLabel('Galaxie', { exact: true });
    const sys = page.getByLabel('System', { exact: true });
    await expect(gal).toHaveValue(g!);
    await expect(sys).toHaveValue(s!);
    await gal.fill('1');
    await sys.fill('1');
    await sys.press('Enter');
    await expect(sys).toHaveValue('1');
    // Galaxies stop at the ends, systems wrap around (galaxyStep).
    await page.getByRole('button', { name: 'vorige Galaxie' }).click();
    await expect(gal).toHaveValue('1');
    await page.getByRole('button', { name: 'nächste Galaxie' }).click();
    await expect(gal).toHaveValue('2');
    await page.getByRole('button', { name: 'voriges System' }).click();
    await expect(sys).toHaveValue('50');
    await page.getByRole('button', { name: 'nächstes System' }).click();
    await expect(sys).toHaveValue('1');
    await sys.fill('7');
    await expect(farRow).toHaveCount(0);
    await sys.press('Enter');
    await expect(sys).toHaveValue('7');
    await expect(gal).toHaveValue('2');
    await expect(farRow).toContainText(name);
    await expect(farRow.locator('td.n')).toHaveText('15');
    await page.getByText('zum Heimatsystem').click();
    await expect(gal).toHaveValue(g!);
    await expect(sys).toHaveValue(s!);
    const colony = page.locator('tr.me', { hasText: 'Kolonie' });
    await colony.getByRole('button', { name: 'Wechseln' }).click();
    await expectShownPlace(page, 'Kolonie');
    await expect(colony).toContainText('Aktiver Planet');
    await expect(
      page
        .locator('tr.me', { hasText: 'Heimatplanet' })
        .getByRole('button', { name: 'Wechseln' }),
    ).toBeVisible();
    expect(w.problems).toEqual([]);
  });
});
