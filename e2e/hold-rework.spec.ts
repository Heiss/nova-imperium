// The rework of Wache stellen (#440): the host sends a guard away under
// „Gehaltene Flotten“, once on its way and once while it holds, and its owner
// gets the report; the host is told of the launch. The admin switches
// „Wache stellen“ off in „Universum“: the running guard turns home with its
// report and the fleet form no longer offers the mission; switched on again,
// it is back. The tests run one after another (one worker) and put the
// setting back. Desktop and phone for „Wegschicken“.
import { expect, test, type Browser, type Page } from '@playwright/test';
import {
  cli,
  galaxyAction,
  galaxyRow,
  lastToast,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

/** Opens the galaxy at the home system of another player, from the highscore. */
async function openSystemOf(page: Page, player: string): Promise<void> {
  await nav(page, 'highscore');
  await page
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: player, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

/** Opens the fleet form towards the home planet of `host` with one Kathedralschiff. */
async function aimAt(page: Page, host: string): Promise<void> {
  await openSystemOf(page, host);
  await (
    await galaxyAction(page, galaxyRow(page, host), 'Versorgungsflug')
  ).click();
  await page.getByLabel('Anzahl Kathedralschiff').fill('1');
}

/** Sends one Kathedralschiff of `page` to hold at `host`. */
async function sendGuard(page: Page, host: string): Promise<void> {
  await aimAt(page, host);
  await page.getByLabel('Auftrag').selectOption('hold');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
}

/** A host and a guard who are friends; the guard has ships, fuel and slots. */
async function friends(
  page: Page,
  browser: Browser,
): Promise<{ host: string; guard: string; pg: Page; problems: string[][] }> {
  const host = uniqueName('Gastgeber');
  const guard = uniqueName('Waechter');
  const w = watch(page);
  await register(page, host);
  const pg = await browser.newPage({ viewport: page.viewportSize() });
  const wg = watch(pg);
  await register(pg, guard);
  seed({
    name: guard,
    ships: { bs: 3 },
    res: { m: 0, c: 0, d: 50000 },
    research: { computer: 3 },
  });
  await nav(pg, 'friends');
  await pg.getByLabel('Name', { exact: true }).fill(host);
  await pg.getByRole('button', { name: 'Freundschaft anfragen' }).click();
  await expect(lastToast(pg)).toContainText('Anfrage gesendet.');
  await page.reload();
  await nav(page, 'friends');
  await page
    .locator('#view p')
    .filter({ hasText: guard })
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(lastToast(page)).toContainText('Anfrage angenommen.');
  return { host, guard, pg, problems: [w.problems, wg.problems] };
}

/** The box „Gehaltene Flotten“ of the host's overview, freshly loaded. */
async function heldBox(page: Page) {
  await page.reload();
  await nav(page, 'overview');
  return page.locator('.box', { hasText: 'Gehaltene Flotten' });
}

for (const phone of ['', ' @phone'])
  test(`the host sends a guard away on its way and while it holds (#440)${phone}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const { host, guard, pg, problems } = await friends(page, browser);
    const away = `${host} hat deine Wache bei`;

    // On its way: the host sees it and is told of the launch.
    await sendGuard(pg, host);
    let held = await heldBox(page);
    await expect(held).toContainText(`Eine fremde Flotte von ${guard}`);
    await nav(page, 'messages');
    await expect(page.locator('#view')).toContainText(
      `${guard} schickt eine Wache zu`,
    );
    held = await heldBox(page);
    await held.getByRole('button', { name: 'Wegschicken' }).click();
    await expect(page.getByText('Gehaltene Flotten')).toHaveCount(0);
    await pg.reload();
    await nav(pg, 'messages');
    await expect(pg.locator('#view')).toContainText(away);

    // While it holds.
    await pg.reload();
    await sendGuard(pg, host);
    seed({ name: guard, landFleet: 'hold' });
    held = await heldBox(page);
    await expect(held).toContainText(`Flotte von ${guard}`, { timeout: 15000 });
    await held.getByRole('button', { name: 'Wegschicken' }).click();
    await expect(page.getByText('Gehaltene Flotten')).toHaveCount(0);
    await pg.reload();
    await nav(pg, 'fleet');
    await expect(pg.locator('.fl-back')).toHaveCount(2);

    expect(problems.flat()).toEqual([]);
  });

/** The admin sets „Wache stellen“ in „Universum“ and saves. */
async function switchHold(admin: Page, on: '0' | '1'): Promise<void> {
  await nav(admin, 'admin');
  await admin.getByRole('tab', { name: 'Universum' }).click();
  await admin.getByLabel('Wache stellen', { exact: true }).selectOption(on);
  await admin.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(lastToast(admin)).toContainText('Einstellungen gespeichert.');
}

test('„Wache stellen“ off turns a guard home and hides the mission (#440)', async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const { host, pg, problems } = await friends(page, browser);
  await sendGuard(pg, host);
  cli('admin', host);
  try {
    await page.reload();
    await switchHold(page, '0');
    await nav(pg, 'fleet');
    await pg.reload();
    await nav(pg, 'messages');
    await expect(pg.locator('#view')).toContainText('kehrt zurück');
    await pg.reload();
    await aimAt(pg, host);
    await expect(
      pg.getByLabel('Auftrag').locator('option[value=hold]'),
    ).toHaveCount(0);
    await switchHold(page, '1');
    await pg.reload();
    await aimAt(pg, host);
    await expect(
      pg.getByLabel('Auftrag').locator('option[value=hold]'),
    ).toHaveCount(1);
  } finally {
    await page.reload();
    await switchHold(page, '1').catch(() => {});
    cli('unadmin', host);
  }
  expect(problems.flat()).toEqual([]);
});
