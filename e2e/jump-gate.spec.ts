// The Warp-Tor (#53, #230, okf/features/moons.md; owner, 2026-11-13 and
// 2026-11-16): a building of the moon after the Auspex-Phalanx that needs
// Mondzitadelle 1 and Warp-Theorie 7, and the jump in the fleet view: the
// picked ships move at once to another own moon with a Warp-Tor, the
// resources stay, and both gates cool down („Wieder bereit in …“). The
// player has the moon „Mond“ of the home planet and the moon „Luna“ of a
// colony on slot 15 of the home system (e2e/seed.ts).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectShownPlace,
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

/** Switches to the own moon `name` in the planet list. */
async function chooseMoon(page: Page, name: string): Promise<void> {
  const selector = page.getByLabel('Aktiver Planet');
  const option = selector.locator('option', { hasText: `${name} (Mond) [` });
  await selector.selectOption((await option.getAttribute('value'))!);
  await expectShownPlace(page, `${name} (Mond)`);
}

/** The box „Warp-Tor“ of the fleet view. */
const gateBox = (page: Page): Locator =>
  page.locator('.box').filter({ hasText: 'Zielmond' });

/** The number of a ship on the shown place, column „vorhanden“ of the fleet view. */
const have = (page: Page, ship: string): Locator =>
  page.locator('tr').filter({ hasText: ship }).locator('td.n').first();

/** A player with two moons with a Warp-Tor: „Mond“ with ships, „Luna“ with one. */
async function setup(page: Page, base: string): Promise<string> {
  const name = uniqueName(base);
  await register(page, name);
  seed({
    name,
    colony: { name: 'Kolonie' },
    moon: {
      b: { moonbase: 1, jumpgate: 1 },
      ships: { lf: 5, sat: 2 },
      res: { m: 1000, c: 0, d: 0 },
    },
    colonyMoon: {
      name: 'Luna',
      b: { moonbase: 1, jumpgate: 1 },
      ships: { lf: 1 },
    },
  });
  await page.reload();
  await chooseMoon(page, 'Mond');
  await nav(page, 'fleet');
  return name;
}

test.describe('the Warp-Tor (#230)', () => {
  test('stands on the moon after the Auspex-Phalanx and needs Mondzitadelle and Warp-Theorie', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('WarpBau');
    await register(page, name);
    seed({ name, moon: { res: { m: 1e7, c: 1e7, d: 1e7 } } });
    await page.reload();
    await nav(page, 'buildings');
    await expect(
      page.locator('.item .nm', { hasText: 'Warp-Tor' }),
    ).toHaveCount(0);
    await chooseMoon(page, 'Mond');
    await nav(page, 'buildings');
    await expect(page.locator('.item .nm').last()).toHaveText(/^Warp-Tor/);
    const gate = page.locator('.item', { hasText: 'Warp-Tor' });
    await expect(gate).toContainText('Mondzitadelle');
    await expect(gate).toContainText('Warp-Theorie');
    await expect(gate).toContainText('2.000.000');
    await expect(gate).toContainText('4.000.000');
    await expect(gate).toContainText('Das Wissen ist noch verschlossen');
    seed({ name, research: { hyper: 7 }, moon: { b: { moonbase: 1 } } });
    await page.reload();
    await chooseMoon(page, 'Mond');
    await nav(page, 'buildings');
    await gate.getByRole('button', { name: 'Bauen', exact: true }).click();
    await expect(gate).toContainText('Ausbau auf Stufe 1');
    expect(w.problems).toEqual([]);
  });

  test('jumps the picked ships to the Zielmond, leaves the resources and cools both gates', async ({
    page,
  }) => {
    const w = watch(page);
    await setup(page, 'Warp');
    const box = gateBox(page);
    await expect(box.locator('.hd')).toHaveText('Warp-Tor');
    const target = box.getByLabel('Zielmond');
    await expect(target.locator('option')).toHaveText([
      /^Luna \(Mond\) \[\d+:\d+:15\]$/,
    ]);
    // The Sonnenreliquiare are not offered, as in the fleet form.
    await expect(page.getByLabel('Anzahl Sonnenreliquiar')).toHaveCount(0);
    expect(await violations(page)).toEqual([]);

    // Without ships the server refuses the jump.
    await box.getByRole('button', { name: 'Springen' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Keine Schiffe ausgewählt.',
    );

    await page.getByLabel('Anzahl Abfangjäger').fill('3');
    await box.getByRole('button', { name: 'Springen' }).click();
    await expect(have(page, 'Abfangjäger')).toHaveText('2');
    await expect(box).toContainText('Wieder bereit in');
    await expect(box.getByRole('button', { name: 'Springen' })).toBeDisabled();
    await expect(stock(page, 'Adamant')).toHaveText('1.000');
    expect(await violations(page)).toEqual([]);

    // The ships are on „Luna“, whose gate cools down too.
    await chooseMoon(page, 'Luna');
    await nav(page, 'fleet');
    await expect(have(page, 'Abfangjäger')).toHaveText('4');
    await expect(gateBox(page)).toContainText('Wieder bereit in');
    await expect(
      gateBox(page).getByRole('button', { name: 'Springen' }),
    ).toBeDisabled();
    await expect(
      gateBox(page).getByLabel('Zielmond').locator('option'),
    ).toHaveText([/^Mond \(Mond\) \[\d+:\d+:\d+\] – Wieder bereit in /]);
    await expect(stock(page, 'Adamant')).toHaveText('0');
    expect(w.problems).toEqual([]);
  });

  test('jumps on a phone @phone', async ({ page }) => {
    const w = watch(page);
    await setup(page, 'WarpHandy');
    await page.getByLabel('Anzahl Abfangjäger').fill('5');
    await gateBox(page).getByRole('button', { name: 'Springen' }).tap();
    await expect(gateBox(page)).toContainText('Wieder bereit in');
    await expect(page.getByLabel('Anzahl Abfangjäger')).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(await violations(page)).toEqual([]);
    expect(w.problems).toEqual([]);
  });
});
