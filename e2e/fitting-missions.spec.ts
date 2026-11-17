// The list „Auftrag“ of the fleet form offers only the missions that fit the
// target at the entered coordinates (#253, owner, 2026-11-16): on an own
// planet the ones for an own or any planet, on a free position the ones for
// a free position, on a foreign planet the ones for a foreign or any planet,
// and the Bergung where a Trümmerfeld lies. A chosen mission that no longer
// fits switches to the first that fits. The own colony is on slot 15.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  galaxyRow,
  nav,
  register,
  seed,
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

async function openSystemOf(page: Page, player: string): Promise<void> {
  await nav(page, 'highscore');
  await page
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: player, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

const list = (page: Page) => page.getByLabel('Auftrag');

/** The missions the list offers, by their keys in the order of the list. */
const offered = (page: Page): Promise<string[]> =>
  list(page)
    .locator('option')
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );

/** Enters a free position of the shown system as the target. */
async function enterFreePosition(page: Page): Promise<void> {
  for (let p = 1; p <= 15; p++) {
    await page.getByLabel('Position', { exact: true }).fill(String(p));
    if ((await page.locator('#t_info').innerText()) === 'Freie Position')
      return;
  }
  throw new Error('no free position in the home system');
}

/**
 * A changed state mounts the fleet view anew: the stock of the player
 * changes, and the list „Auftrag“ is a new element.
 */
async function remount(page: Page, name: string, m: number): Promise<void> {
  await list(page).evaluate((select) => (select.dataset.old = '1'));
  seed({ name, res: { m, c: 5000, d: 5000 } });
  await page.evaluate(() =>
    document.dispatchEvent(new Event('visibilitychange')),
  );
  await expect(page.locator('#t_m[data-old]')).toHaveCount(0);
}

async function fittingMissions(page: Page): Promise<void> {
  const w = watch(page);
  const a = uniqueName('Passend');
  const b = uniqueName('Fremd');
  await register(page, b);
  await page.click('[data-act=logout]');
  await register(page, a);
  seed({ name: b, debris: { m: 1800, c: 600 } });
  seed({ name: a, ships: { sc: 2 }, colony: {} });

  // The form opens with the shown planet as the target: an own planet.
  await page.goto('/?view=fleet');
  await expect.poll(() => offered(page)).toEqual(['transport', 'deploy']);
  await expect(list(page)).toHaveValue('transport');
  expect(await violations(page)).toEqual([]);

  // The own colony: the same missions, and the chosen one stays.
  await page.getByLabel('Position', { exact: true }).fill('15');
  await list(page).selectOption('deploy');
  await expect.poll(() => offered(page)).toEqual(['transport', 'deploy']);
  await expect(list(page)).toHaveValue('deploy');

  // A free position: the chosen Stationierung no longer fits, so the list
  // switches to the first mission that fits.
  await enterFreePosition(page);
  await expect.poll(() => offered(page)).toEqual(['colonize']);
  await expect(list(page)).toHaveValue('colonize');
  await expect(
    page.getByRole('button', { name: 'Flotte losschicken' }),
  ).toBeEnabled();
  // A refresh of the state mounts the view anew: the typed target and its
  // missions stay.
  await remount(page, a, 5000);
  expect(await offered(page)).toEqual(['colonize']);
  await expect(list(page)).toHaveValue('colonize');

  // A foreign planet with a Trümmerfeld, from the Sternenkarte: neither
  // Landnahme nor Stationierung, and the Bergung beside the planet's own.
  await openSystemOf(page, b);
  await galaxyRow(page, b).getByText('Sturmangriff').click();
  await expect(page.locator('h2')).toHaveText('Flotte');
  await expect
    .poll(() => offered(page))
    .toEqual(['attack', 'transport', 'spy', 'harvest']);
  await expect(list(page)).toHaveValue('attack');
  // Another mission that fits stays chosen over a refresh.
  await list(page).selectOption('spy');
  await remount(page, a, 6000);
  await expect(list(page)).toHaveValue('spy');
  expect(await violations(page)).toEqual([]);
  // Against the device width: a too wide form also widens innerWidth.
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(w.problems).toEqual([]);
}

test.describe('the fleet form offers only the missions that fit the target (#253)', () => {
  test('own planet, free position, foreign planet with a Trümmerfeld', async ({
    page,
  }) => {
    await fittingMissions(page);
  });

  test('own planet, free position, foreign planet with a Trümmerfeld, on a phone @phone', async ({
    page,
  }) => {
    await fittingMissions(page);
  });
});
