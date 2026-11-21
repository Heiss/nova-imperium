// Wache stellen (#55): a guild member sends a fleet with a holding time to
// the planet of another member; a player outside the guild is refused. The
// fleet holds there, the host sees it under „Gehaltene Flotten“, it defends
// the planet in a battle and its owner gets the report of the defender with
// the fleet as a defender of its own; after the holding time it flies home.
// Flights and the end of holding are moved forward with e2e/seed.ts.
// Desktop and phone.
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  galaxyAction,
  galaxyRow,
  guildTag,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const lastToast = (page: Page): Locator => page.locator('.toast').last();
const report = (page: Page, title: string | RegExp): Locator =>
  page.locator('.rep').filter({ has: page.locator('.t', { hasText: title }) });

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

/** Opens the fleet form towards the home planet of `host`, with `ships` chosen. */
async function aimAt(
  page: Page,
  host: string,
  ships: Record<string, string>,
): Promise<void> {
  await openSystemOf(page, host);
  await (
    await galaxyAction(page, galaxyRow(page, host), 'Versorgungsflug')
  ).click();
  for (const [label, n] of Object.entries(ships))
    await page.getByLabel(`Anzahl ${label}`).fill(n);
}

for (const phone of ['', ' @phone'])
  test(`a guild member holds at an ally, defends it in a battle and flies home${phone}`, async ({
    page,
    browser,
  }) => {
    // Three players, a guild, a spy report, a battle and the flight home:
    // about 26 s on an idle machine, too close to the default 30 s.
    test.setTimeout(90_000);
    const host = uniqueName('Wirt');
    const guard = uniqueName('Wache');
    const raider = uniqueName('Raeuber');
    const tag = guildTag('H');
    const title = `[${tag}] Gilde ${tag}`;
    const w = watch(page);

    // The host founds a guild; mines keep the noob protection away.
    await register(page, host);
    seed({ name: host, b: { metal: 12, crystal: 10 } });
    await nav(page, 'guilds');
    await page.getByLabel('Kürzel').fill(tag);
    await page.getByLabel('Name', { exact: true }).fill(`Gilde ${tag}`);
    await page.getByRole('button', { name: 'Gilde gründen' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    // The guard joins the guild.
    const pg = await browser.newPage({ viewport: page.viewportSize() });
    const wg = watch(pg);
    await register(pg, guard);
    seed({ name: guard, ships: { bs: 2 }, res: { m: 0, c: 0, d: 50000 } });
    await nav(pg, 'guilds');
    await pg.getByRole('link', { name: title }).click();
    await pg.getByRole('button', { name: 'Bewerben' }).click();
    await expect(lastToast(pg)).toContainText('Bewerbung gesendet.');
    await page.reload();
    await page
      .locator('p', { hasText: guard })
      .getByRole('button', { name: 'Annehmen' })
      .click();
    await expect(lastToast(page)).toContainText('Bewerbung angenommen.');

    // „Haltezeit“ shows only for Wache stellen.
    await pg.reload();
    await aimAt(pg, host, { Kathedralschiff: '2' });
    const time = pg.getByLabel('Haltezeit');
    await expect(time).toBeHidden();
    await pg.getByLabel('Auftrag').selectOption('hold');
    await expect(time).toBeVisible();
    await expect(time).toHaveValue('1');
    await time.selectOption('2');
    await pg.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(pg)).toContainText('Flotte unterwegs nach');
    await expect(pg.locator('.fl-hold')).toContainText('Wache stellen');

    // A player outside the guild may not hold there.
    const pr = await browser.newPage({ viewport: page.viewportSize() });
    const wr = watch(pr);
    await register(pr, raider);
    seed({
      name: raider,
      ships: { lf: 3, probe: 5 },
      res: { m: 0, c: 0, d: 50000 },
      // Auspex-Lehre 2: the spy report shows the held fleet apart; three
      // fleet slots for the refused Halten, the scouting and the attack.
      research: { spy: 2, computer: 2 },
    });
    await aimAt(pr, host, { Abfangjäger: '1' });
    await pr.getByLabel('Auftrag').selectOption('hold');
    await pr.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(pr)).toContainText(
      'Wache stellen nur bei Gildenmitgliedern und Freunden.',
    );

    // The fleet arrives and holds; the host sees it.
    seed({ name: guard, landFleet: 'hold' });
    await expect(pg.locator('.fl-hold')).toContainText('hält bei', {
      timeout: 15000,
    });
    await page.reload();
    await nav(page, 'overview');
    const held = page.locator('.box', { hasText: 'Gehaltene Flotten' });
    await expect(held).toContainText(`Flotte von ${guard}`, { timeout: 15000 });
    // The host (Auspex-Lehre 0) sees the exact ships of a fleet that is
    // holding at his planet, whatever his Auspex-Lehre (owner, 2026-11-19).
    await expect(held).toContainText('2 Kathedralschiff');

    // The raider's Auspex-Erkundung shows the held fleet apart (owner,
    // 2026-11-17: from Auspex-Lehre 2 by default).
    await pr.reload();
    await aimAt(pr, host, { Spähschädel: '5' });
    await pr.getByLabel('Auftrag').selectOption('spy');
    await pr.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(pr)).toContainText('Flotte unterwegs nach');
    seed({ name: raider, landFleet: 'spy' });
    await nav(pr, 'messages');
    const spied = report(pr, /^Auspex-Bericht von /);
    await expect(spied).toBeVisible({ timeout: 15000 });
    await spied.locator('.t').click();
    await expect(spied).toContainText('Gehaltene Flotten');
    await expect(spied).toContainText(`${guard}: Kathedralschiff: 2`);

    // The raider attacks with three Abfangjäger: the held fleet defends.
    await pr.reload();
    await aimAt(pr, host, { Abfangjäger: '3' });
    await pr.getByLabel('Auftrag').selectOption('attack');
    await pr.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(pr)).toContainText('Flotte unterwegs nach');
    seed({ name: raider, landFleet: 'attack' });
    const hit = new RegExp(`^Feindkontakt! .* wird von ${raider} angegriffen`);
    for (const p of [pg, page]) {
      await nav(p, 'messages');
      const battle = report(p, hit);
      await expect(battle).toBeVisible({ timeout: 15000 });
      await battle.locator('.t').click();
      await expect(battle).toContainText(`Verteidiger ${host}`);
      await expect(battle).toContainText(`Verteidiger ${guard}`);
      await expect(battle).toContainText(
        'Der Verteidiger hat die Schlacht gewonnen!',
      );
    }

    // After the holding time the fleet flies home.
    seed({ name: guard, endHold: true });
    await nav(pg, 'fleet');
    await expect(pg.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });
    await page.reload();
    await nav(page, 'overview');
    await expect(page.getByText('Gehaltene Flotten')).toHaveCount(0);

    expect([...w.problems, ...wg.problems, ...wr.problems]).toEqual([]);
  });
