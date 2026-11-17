// The main planet (#221, okf/features/main-planet.md): a player makes a
// colony the main planet in the options („Hauptplanet“, „Ändern“); the
// choice is locked for the days of the round (7) with the date it is
// possible again, the server refuses another switch with that date, the
// Sternenkarte's link „zum Heimatsystem“ leads to the colony's system and
// the game shows the colony when no planet is selected. Desktop and phone,
// with axe on the options.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectShownPlace,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const lastToast = (page: Page): Locator => page.locator('.toast').last();

/** The coordinates of the shown planet, from the header. */
async function here(page: Page): Promise<{ g: number; s: number }> {
  const header = await page.locator('#pinfo').innerText();
  const [, g, s] = /\[(\d+):(\d+):\d+\]/.exec(header)!;
  return { g: Number(g), s: Number(s) };
}

/** A switch as from a device that still shows the old options. */
const refusal = (page: Page, main: string): Promise<string | undefined> =>
  page.evaluate(async (id) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'mainPlanet', main: id }),
    });
    return ((await r.json()) as { error?: string }).error;
  }, main);

async function mainPlanetFlow(page: Page): Promise<void> {
  const { problems } = watch(page);
  const player = uniqueName('Hauptwahl');
  const colony = uniqueName('Front');
  await register(page, player);
  const home = await here(page);
  const first = (await page.locator('#pinfo b').first().innerText()).trim();
  // The colony lies in another system of the home galaxy.
  const system = home.s === 1 ? 2 : home.s - 1;
  seed({ name: player, colony: { g: home.g, s: system, p: 9, name: colony } });
  await page.reload();
  // With two places the header names the shown one only in its list (#241).
  await expectShownPlace(page, first);

  await nav(page, 'help');
  const select = page.getByLabel('Hauptplanet', { exact: true });
  const change = page.getByRole('button', { name: 'Ändern', exact: true });
  await expect(select.locator('option:checked')).toHaveText(
    new RegExp(`^${first} \\[.*\\] – Heimatplanet$`),
  );
  await expect(select.locator('option')).toHaveCount(2);
  await expect(
    page.getByText('Nach jedem Wechsel ist die Wahl 7 Tage gesperrt.'),
  ).toBeVisible();
  expect(await violations(page)).toEqual([]);

  await select.selectOption({ label: `${colony} [${home.g}:${system}:9]` });
  await change.click();
  await expect(lastToast(page)).toContainText(
    `${colony} ist jetzt dein Hauptplanet.`,
  );
  // Locked: both disabled, with the date the choice is possible again.
  const lock = page.locator('#o_main_lock');
  await expect(lock).toHaveText(
    /^Wieder änderbar ab \d\d\.\d\d\.\d{4}, \d\d:\d\d$/,
  );
  await expect(select).toBeDisabled();
  await expect(change).toBeDisabled();
  await expect(select.locator('option:checked')).toHaveText(
    new RegExp(`^${colony} \\[`),
  );
  expect(await violations(page)).toEqual([]);
  const firstId = await select
    .locator('option', { hasText: 'Heimatplanet' })
    .getAttribute('value');
  expect(await refusal(page, firstId!)).toMatch(
    /^Der Hauptplanet ist gesperrt\. Wieder änderbar ab \d\d\.\d\d\.\d{4}, \d\d:\d\d\.$/,
  );

  // „zum Heimatsystem“ leads to the main planet's system.
  await nav(page, 'galaxy');
  await page.getByText('zum Heimatsystem').click();
  await expect(page.locator('#g_g')).toHaveValue(String(home.g));
  await expect(page.locator('#g_s')).toHaveValue(String(system));
  await expect(
    page.locator('table.gal tr').filter({ hasText: colony }),
  ).toBeVisible();

  // Without a selection the game shows the main planet.
  await page.goto('/');
  await expectShownPlace(page, colony);
  expect(problems).toEqual([]);
}

test('the main planet is chosen in the options, locked and leads „zum Heimatsystem“', async ({
  page,
}) => {
  await mainPlanetFlow(page);
});

test('the main planet on a phone @phone', async ({ page }) => {
  await mainPlanetFlow(page);
});
