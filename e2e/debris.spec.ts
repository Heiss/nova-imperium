// The Trümmerfeld (#45): a battle leaves one, a Bergung takes it home; the
// Sternenkarte on a phone.
import { expect, test } from '@playwright/test';
import {
  galaxyRow,
  lastToast,
  login,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';
import { attack, openSystemOf, report } from './fleet-helpers.ts';

test.describe('fleet and battle (#68)', () => {
  test('a battle leaves a Trümmerfeld that every player sees; a Bergung takes it home (#45)', async ({
    page,
  }) => {
    // Registering moves the home planet into the area of the test (#302).
    test.slow();
    const w = watch(page);
    const a = uniqueName('Berger');
    const b = uniqueName('Wrack');
    await attack(page, a, b);
    // The Spähschädel (0 / 1,000 / 0) dies: 30 % of it lies at the position.
    const field = 'Trümmerfeld: 0 Adamant, 300 Psikristall';
    const badge = page.locator('#menu [data-v=messages] .badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await nav(page, 'messages');
    const battle = report(page, /^Kampfbericht .* – gewonnen/);
    await battle.locator('.t').click();
    await expect(battle).toContainText(
      'Es entstand ein Trümmerfeld mit 0 Adamant und 300 Psikristall.',
    );
    seed({ name: a, returnFleet: true });
    const returns = report(page, 'Rückkehr zu');
    await expect(returns).toHaveCount(1, { timeout: 15000 });

    // The defender sees the field at his own planet too.
    await page.click('[data-act=logout]');
    await login(page, b);
    await page.goto('/?view=galaxy');
    await page.getByText('zum Heimatsystem').click();
    await expect(
      galaxyRow(page, b).getByRole('img', { name: field }),
    ).toBeVisible();
    await expect(
      galaxyRow(page, b).getByRole('button', { name: 'Bergung' }),
    ).toBeVisible();

    await page.click('[data-act=logout]');
    seed({
      name: a,
      ships: { recycler: 1, lc: 1 },
      res: { m: 0, c: 0, d: 10000 },
    });
    await login(page, a);
    await openSystemOf(page, b);
    const row = galaxyRow(page, b);
    await expect(row.getByRole('img', { name: field })).toHaveAttribute(
      'title',
      field,
    );
    await row.getByRole('button', { name: 'Bergung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('harvest');
    await expect(page.locator('#t_info')).toHaveText(field);
    // A Lastbarke alone may not fly to a Bergung.
    await page.getByLabel('Anzahl Lastbarke').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText(
      'Du brauchst eine Bergungsbarke.',
    );
    await page.getByLabel('Anzahl Bergungsbarke').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await expect(page.locator('.fl-harvest')).toContainText('1 Bergungsbarke');

    seed({ name: a, landFleet: 'harvest' });
    await expect(page.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });
    await nav(page, 'messages');
    const harvested = report(page, /^Bergung erreicht/);
    await harvested.locator('.t').click();
    await expect(harvested).toContainText(
      'Deine Bergungsbarken haben 0 Adamant und 300 Psikristall geborgen.',
    );
    // The field is gone for everybody.
    await openSystemOf(page, b);
    await expect(galaxyRow(page, b).locator('img.debris')).toHaveCount(0);
    await expect(
      galaxyRow(page, b).getByRole('button', { name: 'Bergung' }),
    ).toHaveCount(0);

    seed({ name: a, returnFleet: true });
    await nav(page, 'messages');
    await expect(returns).toHaveCount(2, { timeout: 15000 });
    await returns.first().locator('.t').click();
    await expect(returns.first()).toContainText(
      'Deine Flotte ist zurück und bringt Adamant 0 · Psikristall 300 · Promethium 0 mit.',
    );
    expect(w.problems).toEqual([]);
  });

  test('the Sternenkarte shows a Trümmerfeld with „Bergung“ on a phone (#45) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('BergH');
    const b = uniqueName('WrackH');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    seed({ name: b, debris: { m: 1800, c: 600 } });
    seed({ name: a, ships: { recycler: 1 } });
    await page.reload();
    await openSystemOf(page, b);
    const row = galaxyRow(page, b);
    await expect(
      row.getByRole('img', {
        name: 'Trümmerfeld: 1.800 Adamant, 600 Psikristall',
      }),
    ).toBeVisible();
    await expect(row.getByRole('button', { name: 'Bergung' })).toBeVisible();
    // Against the device width: a too wide table also widens innerWidth.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    await row.getByRole('button', { name: 'Bergung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('harvest');
    expect(w.problems).toEqual([]);
  });
});
