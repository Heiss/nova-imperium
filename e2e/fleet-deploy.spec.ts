// The Verlegung (#129): part of a fleet with its cargo moves to an own
// colony for good, from the fleet form and from the galaxy on a phone.
import { expect, test } from '@playwright/test';
import {
  choosePlanet,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';
import { shipCount } from './fleet-helpers.ts';

test.describe('playing', () => {
  test('a Verlegung moves part of a fleet with its cargo to an own colony for good (#129)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Verleg');
    await register(page, name);
    seed({
      name,
      ships: { sc: 3, lf: 2 },
      res: { m: 100000, c: 100000, d: 100000 },
      colony: { p: 14, name: 'Vorposten', res: { m: 0, c: 0, d: 0 } },
    });
    await page.goto('/?view=fleet');
    await page.getByLabel('Anzahl Frachtläufer').fill('2');
    await page.getByLabel('Position', { exact: true }).fill('14');
    await page.getByLabel('Auftrag').selectOption('deploy');
    await expect(
      page.getByLabel('Auftrag').locator('option:checked'),
    ).toHaveText('Verlegung');
    await page.locator('#c_m').fill('3000');
    await expect(page.locator('#i_arr')).toContainText(' / –');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs nach',
    );
    await expect(page.locator('.fl-deploy')).toContainText('2 Frachtläufer');
    await expect(page.locator('.fl-deploy')).toContainText('Verlegung');
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('1');

    seed({ name, landFleet: 'deploy' });
    await expect(page.locator('.fl-deploy')).toHaveCount(0, {
      timeout: 30000,
    });
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('1');
    await choosePlanet(page, 'Vorposten');
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('2');
    await expect(page.locator('#f_lf')).toHaveCount(0);
    await nav(page, 'messages');
    await page.locator('.rep .t', { hasText: 'Verlegung erreicht' }).click();
    await expect(page.locator('.rep.open')).toContainText(
      'Deine Flotte bleibt auf Vorposten',
    );
    expect(w.problems).toEqual([]);
  });

  test('a Verlegung starts from the galaxy and lands on the colony on a phone (#129) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('VerlH');
    // A unique name: the test above seeds its „Vorposten“ into a home system
    // that can be this one, and the row would match both (#252).
    const outpost = uniqueName('Vorposten');
    await register(page, name);
    seed({
      name,
      ships: { lf: 3 },
      res: { m: 100000, c: 100000, d: 100000 },
      colony: { p: 13, name: outpost, res: { m: 0, c: 0, d: 0 } },
    });
    await page.goto('/?view=galaxy');
    await page.getByText('zum Heimatsystem').click();
    const row = page.locator('tr', { hasText: outpost });
    await expect(row.getByRole('button', { name: 'Verlegung' })).toBeVisible();
    // Against the device width: a too wide table also widens innerWidth.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    await row.getByRole('button', { name: 'Verlegung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('deploy');
    await expect(page.getByLabel('Position', { exact: true })).toHaveValue(
      '13',
    );
    await page.getByLabel('Anzahl Abfangjäger').fill('2');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs nach',
    );
    await expect(page.locator('.fl-deploy')).toContainText('2 Abfangjäger');
    seed({ name, landFleet: 'deploy' });
    await expect(page.locator('.fl-deploy')).toHaveCount(0, {
      timeout: 30000,
    });
    await expect(shipCount(page, 'Abfangjäger')).toHaveText('1');
    await choosePlanet(page, outpost);
    await expect(shipCount(page, 'Abfangjäger')).toHaveText('2');
    expect(w.problems).toEqual([]);
  });
});
