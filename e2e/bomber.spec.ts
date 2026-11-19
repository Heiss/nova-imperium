// The Bomber (#57): built, its drive switches at Hyperraumantrieb 8, flies.
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
  test('the Bomber is built, switches its drive at Hyperraumantrieb 8 and flies (#57)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Belagerungsbomber');
    await register(page, name);
    const base = {
      name,
      b: { robot: 2, yard: 8, lab: 7 },
      ships: { bb: 2 },
      res: { m: 200000, c: 200000, d: 100000 },
    };
    seed({ ...base, research: { impulse: 6, plasma: 5 }, colony: {} });
    await page.goto('/?view=shipyard');
    await openAllRows(page);
    const bb = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Belagerungsbomber/ }),
    });
    await expect(
      bb.getByRole('img', { name: 'Belagerungsbomber' }),
    ).toHaveAttribute('src', '/icons/ships/bomber.svg');
    await expect(bb).toContainText(
      'Angriff 1.000 · Schild 500 · Struktur 75.000 · Ladung 500 · Tempo 8.800 (Plasma-Impulsantrieb)',
    );
    await expect(bb.locator('.needs')).toHaveCount(0);

    seed({ ...base, research: { impulse: 6, plasma: 5, hdrive: 8 } });
    await page.reload();
    await expect(bb).toContainText('Tempo 17.000 (Warp-Antrieb)');
    await page.fill('#q_bb', '1');
    await page.click('[data-act=order][data-k=bb]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Belagerungsbomber in Auftrag gegeben.',
    );

    await nav(page, 'fleet');
    await expect(
      page
        .locator('tr', { hasText: 'Belagerungsbomber' })
        .locator('td.n')
        .nth(1),
    ).toHaveText('17.000');
    await page.getByLabel('Anzahl Belagerungsbomber').fill('2');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_cap')).toContainText('1.000');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await expect(page.locator('.fl-transport')).toContainText(
      '2 Belagerungsbomber',
    );
    expect(w.problems).toEqual([]);
  });

  test('the shipyard shows the Bomber and its drive on a phone (#57) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Bomb');
    await register(page, name);
    seed({ name, b: { robot: 2, yard: 8, lab: 7 }, research: { impulse: 6 } });
    await page.goto('/?view=shipyard');
    await openAllRows(page);
    const bb = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Belagerungsbomber/ }),
    });
    await expect(
      bb.getByRole('img', { name: 'Belagerungsbomber' }),
    ).toBeVisible();
    await expect(bb).toContainText('Tempo 8.800 (Plasma-Impulsantrieb)');
    await expect(
      bb.locator('.need-nm', { hasText: /^Plasma-Lehre$/ }),
    ).toBeVisible();
    await expect(bb.locator('[data-act=order]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});
