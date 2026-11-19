// The Todesstern (#60): built after the Bomber, faster with the
// Nanitenfabrik, flies; the shipyard on a phone.
import { expect, test } from '@playwright/test';
import { nav, register, seconds, seed, uniqueName, watch } from './helpers.ts';

test.describe('playing', () => {
  test('the Todesstern is built after the Bomber, faster with the Nanitenfabrik, and flies (#60)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Stern');
    await register(page, name);
    const base = {
      name,
      research: { hyper: 6, hdrive: 7, graviton: 1 },
      ships: { dstar: 1 },
      res: { m: 5000000, c: 4000000, d: 2000000 },
    };
    seed({ ...base, b: { robot: 2, yard: 12, lab: 7 }, colony: {} });
    await page.goto('/?view=shipyard');
    // Read the order only once the list is rendered (it was flaky before).
    await expect(
      page.locator('.item .nm', { hasText: /^\s*Weltenbrecher/ }),
    ).toBeVisible();
    const names = (await page.locator('.item .nm').allTextContents()).map((t) =>
      t.trim(),
    );
    const at = (nm: string) => names.findIndex((t) => t.startsWith(nm));
    expect(at('Weltenbrecher')).toBe(at('Belagerungsbomber') + 1);
    const ts = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Weltenbrecher/ }),
    });
    await expect(
      ts.getByRole('img', { name: 'Weltenbrecher' }),
    ).toHaveAttribute('src', '/icons/ships/deathstar.svg');
    await expect(ts).toContainText(
      'Angriff 200.000 · Schild 50.000 · Struktur 9.000.000 · Ladung 1.000.000 · Tempo 310',
    );
    await expect(ts).toContainText(
      'Gewaltige Kampfstation; zerstört fast alles mit Schnellfeuer.',
    );
    await expect(ts.locator('.needs')).toHaveCount(0);
    const buildTime = async (): Promise<number> =>
      seconds(
        (await ts.locator('.dim', { hasText: 'Bauzeit' }).textContent())!,
      );
    const before = await buildTime();
    seed({ ...base, b: { robot: 2, yard: 12, lab: 7, nanite: 1 } });
    await page.reload();
    expect(Math.abs((await buildTime()) * 2 - before)).toBeLessThanOrEqual(1);
    await page.fill('#q_dstar', '1');
    await page.click('[data-act=order][data-k=dstar]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Weltenbrecher in Auftrag gegeben.',
    );

    await nav(page, 'fleet');
    await expect(
      page.locator('tr', { hasText: 'Weltenbrecher' }).locator('td.n').nth(1),
    ).toHaveText('310');
    await page.getByLabel('Anzahl Weltenbrecher').fill('1');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_cap')).toContainText('1.000.000');
    await expect(page.locator('#i_fuel')).toHaveText('1 Promethium');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await expect(page.locator('.fl-transport')).toContainText(
      '1 Weltenbrecher',
    );
    expect(w.problems).toEqual([]);
  });

  test('the shipyard shows the Todesstern and its requirements on a phone (#60) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('TodS');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 12, lab: 7 },
      research: { hyper: 6, hdrive: 7 },
    });
    await page.goto('/?view=shipyard');
    const ts = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Weltenbrecher/ }),
    });
    await expect(ts.getByRole('img', { name: 'Weltenbrecher' })).toBeVisible();
    await expect(ts).toContainText('Tempo 310');
    await expect(
      ts.locator('.need-nm', { hasText: /^Gravitonen-Mysterium$/ }),
    ).toBeVisible();
    await expect(ts.locator('[data-act=order]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});
