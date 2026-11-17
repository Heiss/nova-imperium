// The list „Auftrag“ of the fleet form offers only the missions that fit the
// target at the entered coordinates (#253, owner, 2026-11-16): on an own
// planet the ones for an own or any planet, on a free position the ones for
// a free position, on a foreign planet the ones for a foreign or any planet,
// and the Bergung where a Trümmerfeld lies. A chosen mission that no longer
// fits switches to the first that fits. The start planet itself takes no
// mission (owner, 2026-11-17): the list is empty and nothing is sent. The
// „Schnellwahl“ enters another own planet or moon as the target. The own
// colony is on slot 15.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { galaxyRow, register, seed, uniqueName, watch } from './helpers.ts';

/** axe (WCAG 2.1 A and AA) as in e2e/a11y.spec.ts: the violations of the page. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** By the address: on a 360 px phone the table of the ships covers „Mehr“. */
async function openSystemOf(page: Page, player: string): Promise<void> {
  await page.goto('/?view=highscore');
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

const send = (page: Page) =>
  page.getByRole('button', { name: 'Flotte losschicken' });
const quick = (page: Page) => page.getByLabel('Schnellwahl');
const position = (page: Page) => page.getByLabel('Position', { exact: true });

/** Chooses the entry of the „Schnellwahl“ whose text starts with `name`. */
async function choose(page: Page, name: string): Promise<void> {
  const option = quick(page).locator('option', {
    hasText: new RegExp(`^${name} \\[\\d+:\\d+:\\d+\\]$`),
  });
  await quick(page).selectOption((await option.getAttribute('value'))!);
  // The list goes back to its first entry.
  await expect(quick(page)).toHaveValue('');
}

async function fittingMissions(page: Page, width?: number): Promise<void> {
  const w = watch(page);
  const a = uniqueName('Passend');
  const b = uniqueName('Fremd');
  await register(page, b);
  await page.click('[data-act=logout]');
  await register(page, a);
  seed({ name: b, debris: { m: 1800, c: 600 } });
  // The longest name a planet may have, for the width of the „Schnellwahl“.
  seed({
    name: a,
    ships: { sc: 2 },
    colony: { name: 'Aussenposten Zwanzig' },
    moon: { name: 'Luna' },
  });
  if (width) await page.setViewportSize({ width, height: 800 });

  // The form opens with the shown planet as the target, the place the
  // fleet starts from: no mission, and nothing to send.
  await page.goto('/?view=fleet');
  await expect(position(page)).toBeVisible();
  const home = await position(page).inputValue();
  expect(await offered(page)).toEqual([]);
  await expect(send(page)).toBeDisabled();
  expect(await violations(page)).toEqual([]);
  // The form with the „Schnellwahl“ and the longest name stays within the
  // screen (the table of the ships above it is not part of #253).
  for (const part of ['table.kv', '#t_q'])
    expect(
      await page
        .locator(part)
        .evaluate((e) => Math.floor(e.getBoundingClientRect().right)),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);

  // The „Schnellwahl“ lists the other own places after „– wählen –“, the
  // moon after its planet, without the start planet.
  await expect(quick(page).locator('option')).toHaveText([
    '– wählen –',
    /^Luna \(Mond\) \[\d+:\d+:\d+\]$/,
    /^Aussenposten Zwanzig \[\d+:\d+:15\]$/,
  ]);
  // The own moon: its coordinates and „Mond“ are entered, the missions
  // for an own place follow.
  await choose(page, 'Luna \\(Mond\\)');
  await expect(position(page)).toHaveValue(home);
  await expect(page.getByLabel('Zielart')).toHaveValue('moon');
  await expect(page.locator('#t_info')).toContainText('Luna (Mond)');
  await expect.poll(() => offered(page)).toEqual(['transport', 'deploy']);
  await expect(send(page)).toBeEnabled();

  // The own colony: the planet on slot 15, and the chosen mission stays.
  await list(page).selectOption('deploy');
  await choose(page, 'Aussenposten Zwanzig');
  await expect(position(page)).toHaveValue('15');
  await expect(page.getByLabel('Zielart')).toHaveValue('planet');
  await expect(page.locator('#t_info')).toContainText('Aussenposten Zwanzig');
  await expect.poll(() => offered(page)).toEqual(['transport', 'deploy']);
  await expect(list(page)).toHaveValue('deploy');

  // A free position: the chosen Stationierung no longer fits, so the list
  // switches to the first mission that fits.
  await enterFreePosition(page);
  await expect.poll(() => offered(page)).toEqual(['colonize']);
  await expect(list(page)).toHaveValue('colonize');
  await expect(send(page)).toBeEnabled();
  // A refresh of the state mounts the view anew: the typed target and its
  // missions stay.
  await remount(page, a, 5000);
  expect(await offered(page)).toEqual(['colonize']);
  await expect(list(page)).toHaveValue('colonize');

  // Back on the start planet, typed: no mission again.
  await position(page).fill(home);
  await expect.poll(() => offered(page)).toEqual([]);
  await expect(send(page)).toBeDisabled();

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
  expect(w.problems).toEqual([]);
}

test.describe('the fleet form offers only the missions that fit the target (#253)', () => {
  test('start planet, Schnellwahl, free position, foreign planet with a Trümmerfeld', async ({
    page,
  }) => {
    await fittingMissions(page);
  });

  test('start planet, Schnellwahl, free position, foreign planet with a Trümmerfeld, on a 360 px phone @phone', async ({
    page,
  }) => {
    await fittingMissions(page, 360);
  });
});
