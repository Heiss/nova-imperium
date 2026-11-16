// The Auspex-Phalanx (#53, okf/features/moons.md; owner, 2026-11-15): a
// building of the moon after the Mondzitadelle, and its scan at a foreign
// planet row of the Sternenkarte, offered from a moon with a phalanx at a
// planet in range. The result shows in a panel there: per flight its ships,
// origin, target and arrival. A scan costs 5,000 Promethium, also when it
// finds nothing. The target planet is a colony of the other player in the
// scanner's home system (e2e/seed.ts), so level 1 (the own system) reaches it.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectShownPlace,
  galaxyRow,
  nav,
  register,
  seed,
  stock,
  uniqueName,
  watch,
} from './helpers.ts';

/** axe (WCAG 2.1 A and AA) as in e2e/a11y.spec.ts: the violations of the page. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** The coordinates of the shown place, from the header. */
async function here(page: Page): Promise<{ g: number; s: number; p: number }> {
  const header = await page.locator('#pinfo').innerText();
  const [, g, s, p] = /\[(\d+):(\d+):(\d+)\]/.exec(header)!;
  return { g: Number(g), s: Number(s), p: Number(p) };
}

/** Switches to the own moon in the planet list. */
async function chooseMoon(page: Page): Promise<void> {
  const selector = page.getByLabel('Aktiver Planet');
  const option = selector.locator('option', { hasText: 'Mond (Mond) [' });
  await selector.selectOption((await option.getAttribute('value'))!);
  await expectShownPlace(page, 'Mond (Mond)');
}

/** Opens the Sternenkarte at the home system. */
async function homeSystem(page: Page): Promise<void> {
  await nav(page, 'galaxy');
  await page.getByText('zum Heimatsystem').click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

/** The row of a planet on the Sternenkarte, by its name. */
const planetRow = (page: Page, name: string): Locator =>
  page.locator('table.gal tr').filter({ hasText: name });

const panel = (page: Page): Locator => page.locator('#scan');

/**
 * A scanner with a moon and a phalanx of level 1 and a target player with a
 * colony „Spähziel“ at position `at` of the scanner's home system.
 */
async function setup(
  page: Page,
  base: string,
  at: number,
): Promise<{ scanner: string; target: string }> {
  const target = uniqueName(`${base}Ziel`);
  const scanner = uniqueName(base);
  await register(page, target);
  await page.click('[data-act=logout]');
  await register(page, scanner);
  const home = await here(page);
  seed({
    name: target,
    colony: { g: home.g, s: home.s, p: at, name: 'Spähziel' },
  });
  seed({
    name: scanner,
    moon: {
      b: { moonbase: 1, phalanx: 1 },
      ships: { sc: 1 },
      res: { m: 0, c: 0, d: 20000 },
    },
  });
  await page.reload();
  return { scanner, target };
}

test.describe('the Auspex-Phalanx (#53)', () => {
  test('stands on the moon after the Mondzitadelle and needs it', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('PhalanxBau');
    await register(page, name);
    seed({ name, moon: { res: { m: 1e6, c: 1e6, d: 1e6 } } });
    await page.reload();
    // Not on the planet.
    await nav(page, 'buildings');
    await expect(
      page.locator('.item .nm', { hasText: 'Auspex-Phalanx' }),
    ).toHaveCount(0);
    await chooseMoon(page);
    await nav(page, 'buildings');
    await expect(page.locator('.item .nm').last()).toHaveText(
      /^Auspex-Phalanx/,
    );
    const phalanx = page.locator('.item', { hasText: 'Auspex-Phalanx' });
    await expect(phalanx).toContainText('Mondzitadelle');
    await expect(phalanx).toContainText('20.000');
    await expect(phalanx).toContainText('40.000');
    await expect(phalanx).toContainText('Das Wissen ist noch verschlossen');
    await expect(
      phalanx.getByRole('button', { name: 'Bauen', exact: true }),
    ).toHaveCount(0);
    // With the Mondzitadelle it can be built.
    seed({ name, moon: { b: { moonbase: 1 } } });
    await page.reload();
    await chooseMoon(page);
    await nav(page, 'buildings');
    await phalanx.getByRole('button', { name: 'Bauen', exact: true }).click();
    await expect(phalanx).toContainText('Ausbau auf Stufe 1');
    expect(w.problems).toEqual([]);
  });

  test('scans a foreign planet in range from the moon and shows its flights in a panel', async ({
    page,
  }) => {
    const w = watch(page);
    const { scanner } = await setup(page, 'Phalanx', 3);
    // From the planet: no scan.
    await homeSystem(page);
    const target = planetRow(page, 'Spähziel');
    await expect(target).toBeVisible();
    await expect(
      target.getByRole('button', { name: /Phalanx-Scan/ }),
    ).toHaveCount(0);

    await chooseMoon(page);
    await homeSystem(page);
    const scan = target.getByRole('button', {
      name: 'Phalanx-Scan von Spähziel',
    });
    await expect(scan).toBeVisible();
    // At foreign planets only, not at the own one.
    await expect(
      galaxyRow(page, scanner).getByRole('button', { name: /Phalanx-Scan/ }),
    ).toHaveCount(0);
    await expect(stock(page, 'Promethium')).toHaveText('20.000');

    // No flights: an empty result for 5,000 Promethium.
    await scan.click();
    const heading = panel(page).getByRole('heading', { level: 3 });
    await expect(heading).toHaveText(/^Phalanx-Scan: Spähziel \[\d+:\d+:3\]$/);
    await expect(heading).toBeFocused();
    await expect(panel(page)).toContainText('Keine Flüge erfasst.');
    await expect(stock(page, 'Promethium')).toHaveText('15.000');
    expect(await violations(page)).toEqual([]);

    // A Versorgungsflug from the moon to the planet: the scan shows it.
    await target.getByText('Versorgungsflug').click();
    await page.getByLabel('Anzahl Frachtläufer').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs nach',
    );
    await homeSystem(page);
    await target
      .getByRole('button', { name: 'Phalanx-Scan von Spähziel' })
      .click();
    const rows = panel(page).locator('table.scan tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveText(
      /Schiffe\s*Herkunft\s*Ziel\s*Ankunft/,
    );
    const flight = rows.nth(1).locator('td');
    await expect(flight.nth(0)).toHaveText('1 Frachtläufer');
    await expect(flight.nth(1)).toHaveText(/^\[\d+:\d+:\d+\] \(Mond\)$/);
    await expect(flight.nth(2)).toHaveText(/^\[\d+:\d+:3\]$/);
    await expect(flight.nth(3).locator('.cd')).toBeVisible();
    // Nothing else of the flight: no owner, no mission, no cargo.
    await expect(panel(page)).not.toContainText('Versorgungsflug');
    await expect(panel(page)).not.toContainText('Adamant');
    expect(await violations(page)).toEqual([]);

    // „Schließen“ hides the panel; the focus goes back to the scan.
    await panel(page).getByRole('button', { name: 'Schließen' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(
      target.getByRole('button', { name: 'Phalanx-Scan von Spähziel' }),
    ).toBeFocused();
    expect(w.problems).toEqual([]);
  });

  test('refuses the scan without 5,000 Promethium on the moon and charges nothing', async ({
    page,
  }) => {
    const w = watch(page);
    const { scanner } = await setup(page, 'PhalanxArm', 3);
    seed({ name: scanner, moon: { res: { m: 0, c: 0, d: 4000 } } });
    await page.reload();
    await chooseMoon(page);
    await homeSystem(page);
    await planetRow(page, 'Spähziel')
      .getByRole('button', { name: 'Phalanx-Scan von Spähziel' })
      .click();
    await expect(page.locator('.toast').last()).toContainText(
      'Nicht genug Promethium für den Phalanx-Scan.',
    );
    await expect(panel(page)).toHaveCount(0);
    await expect(stock(page, 'Promethium')).toHaveText('4.000');
    expect(w.problems).toEqual([]);
  });

  test('scans and shows the panel on a phone @phone', async ({ page }) => {
    const w = watch(page);
    await setup(page, 'PhalanxHandy', 2);
    await chooseMoon(page);
    await homeSystem(page);
    const target = planetRow(page, 'Spähziel');
    await target.getByText('Versorgungsflug').tap();
    await page.getByLabel('Anzahl Frachtläufer').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).tap();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs nach',
    );
    await homeSystem(page);
    await target
      .getByRole('button', { name: 'Phalanx-Scan von Spähziel' })
      .tap();
    await expect(panel(page).locator('table.scan tr')).toHaveCount(2);
    await expect(panel(page)).toContainText('1 Frachtläufer');
    // Against the device width: a too wide panel also widens innerWidth.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(await violations(page)).toEqual([]);
    expect(w.problems).toEqual([]);
  });
});
