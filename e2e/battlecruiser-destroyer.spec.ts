// Schlachtkreuzer and Zerstörer (#58, #59): built, flying, and the shipyard
// on a phone.
import { expect, test } from '@playwright/test';
import {
  nav,
  openAllRows,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('playing', () => {
  test('Schlachtkreuzer and Zerstörer are built and fly (#58, #59)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Fregatte');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 9, lab: 7 },
      research: { energy: 5, shield: 5, laser: 12, hyper: 5, hdrive: 6 },
      ships: { bc: 2, dr: 1 },
      res: { m: 200000, c: 200000, d: 100000 },
      colony: {},
    });
    await page.goto('/?view=shipyard');
    const item = (nm: string) =>
      page.locator('.item').filter({
        has: page.locator('.nm', { hasText: new RegExp(`^\\s*${nm}`) }),
      });
    const bc = item('Jagdkreuzer');
    const dr = item('Vernichter');
    await expect(bc.getByRole('img', { name: 'Jagdkreuzer' })).toHaveAttribute(
      'src',
      '/icons/ships/battlecruiser.svg',
    );
    await expect(dr.getByRole('img', { name: 'Vernichter' })).toHaveAttribute(
      'src',
      '/icons/ships/destroyer.svg',
    );
    await expect(bc).toContainText(
      'Angriff 700 · Schild 600 · Struktur 70.000 · Ladung 750 · Tempo 28.000',
    );
    await expect(dr).toContainText(
      'Angriff 2.000 · Schild 750 · Struktur 110.000 · Ladung 2.000 · Tempo 14.000',
    );
    await expect(bc.locator('.needs')).toHaveCount(0);
    await expect(dr.locator('.needs')).toHaveCount(0);
    await page.fill('#q_bc', '1');
    await page.click('[data-act=order][data-k=bc]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Jagdkreuzer in Auftrag gegeben.',
    );
    await page.fill('#q_dr', '1');
    await page.click('[data-act=order][data-k=dr]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Vernichter in Auftrag gegeben.',
    );

    await nav(page, 'fleet');
    await page.getByLabel('Anzahl Jagdkreuzer').fill('2');
    await page.getByLabel('Anzahl Vernichter').fill('1');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_cap')).toContainText('3.500');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await expect(page.locator('.fl-transport')).toContainText(
      '2 Jagdkreuzer, 1 Vernichter',
    );
    expect(w.problems).toEqual([]);
  });

  test('the shipyard shows Schlachtkreuzer and Zerstörer on a phone (#58, #59) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Zerst');
    await register(page, name);
    seed({ name, b: { robot: 2, yard: 8, lab: 7 }, research: { hdrive: 5 } });
    await page.goto('/?view=shipyard');
    await openAllRows(page);
    await expect(page.getByRole('img', { name: 'Jagdkreuzer' })).toBeVisible();
    const dr = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Vernichter/ }),
    });
    await expect(dr.getByRole('img', { name: 'Vernichter' })).toBeVisible();
    await expect(
      dr.locator('.need-nm', { hasText: /^Orbitale Schiffsschmiede$/ }),
    ).toBeVisible();
    await expect(dr.locator('[data-act=order]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});
