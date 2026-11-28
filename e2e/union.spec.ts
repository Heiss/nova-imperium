// The attack union (#225, okf/features/holding-acs.md, „Built with #225“): the
// leader opens a union from an own Sturmangriff on its way and invites a
// friend, who joins from the box „Verbandsangriff“ with „Beitreten“; the
// fleets arrive together and both owners get the report of the battle with
// the other attacker. A friend without an invitation is refused, and the
// recall of the leader's fleet turns back every fleet of the union. The texts
// of the box and of the refusals are drafts [V] of the build, so the specs
// check the words the decision names („Verbandsangriff“, „Beitreten“) and the
// structure (which box, which fleet, which report), not whole sentences.
// Flights are moved forward with e2e/seed.ts. Desktop; the recall also on a
// phone.
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  galaxyAction,
  galaxyRow,
  lastToast,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';
import { openSystemOf, report } from './fleet-helpers.ts';

/** A player of the test with a page of its own, the size of the first page. */
interface Player {
  name: string;
  page: Page;
  problems: string[];
}

async function join(
  browser: Browser,
  size: ReturnType<Page['viewportSize']>,
  base: string,
  first?: Page,
): Promise<Player> {
  const page = first ?? (await browser.newPage({ viewport: size }));
  const { problems } = watch(page);
  const name = uniqueName(base);
  await register(page, name);
  return { name, page, problems };
}

/** `answerer` accepts the friendship `asker` asks for (#227). */
async function befriend(asker: Player, answerer: Player): Promise<void> {
  await nav(asker.page, 'friends');
  await asker.page.getByLabel('Name', { exact: true }).fill(answerer.name);
  await asker.page
    .getByRole('button', { name: 'Freundschaft anfragen' })
    .click();
  await expect(lastToast(asker.page)).toContainText('Anfrage gesendet.');
  await answerer.page.reload();
  await nav(answerer.page, 'friends');
  await answerer.page
    .locator('#view p')
    .filter({ hasText: asker.name })
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(lastToast(answerer.page)).toContainText('Anfrage angenommen.');
}

/** The defender: mines and a probe keep the noob protection away, as in `attack()`. */
async function defender(
  browser: Browser,
  size: ReturnType<Page['viewportSize']>,
): Promise<Player> {
  const player = await join(browser, size, 'Verteidiger');
  seed({
    name: player.name,
    b: { metal: 12, crystal: 10 },
    ships: { probe: 1 },
    res: { m: 50000, c: 50000, d: 50000 },
  });
  return player;
}

/** Gives the player Abfangjäger and Promethium for the flight. */
const arm = (name: string, lf: number): void => {
  seed({ name, ships: { lf }, res: { m: 0, c: 0, d: 50000 } });
};

/**
 * Sends `ships` Abfangjäger against the home planet of `target` with a
 * Sturmangriff at `pct` tenths of the speed. The union arrives with this
 * fleet (#466): at 30 % a friend one position farther away reaches it
 * between 10 % and 100 %.
 */
async function sturmangriff(
  p: Player,
  target: Player,
  ships: number,
  pct = '3',
): Promise<void> {
  await openSystemOf(p.page, target.name);
  await (
    await galaxyAction(p.page, galaxyRow(p.page, target.name), 'Sturmangriff')
  ).click();
  await expect(p.page.getByLabel('Auftrag')).toHaveValue('attack');
  await p.page.getByLabel('Anzahl Abfangjäger').fill(String(ships));
  await p.page.getByLabel('Geschwindigkeit').selectOption(pct);
  await p.page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(p.page)).toContainText('Flotte unterwegs nach');
}

/** The box of a union in the fleet view; `.union` is its row. */
const union = (page: Page): Locator => page.locator('#view .union');

/** The leader opens the union of the Sturmangriff on its way and invites `invited`. */
async function openAndInvite(leader: Player, invited: Player): Promise<void> {
  const { page } = leader;
  await nav(page, 'fleet');
  await expect(union(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Angriffsverband eröffnen' }).click();
  await expect(union(page)).toContainText(`Anführer ${leader.name}`);
  await page
    .getByLabel('Spieler zum Angriffsverband einladen')
    .fill(invited.name);
  await page.getByRole('button', { name: 'Einladen' }).click();
  await expect(union(page)).toContainText(`Eingeladen: ${invited.name}`);
}

/**
 * The invited player joins with „Beitreten“ and sends the fleet the form is
 * filled with; the form shows the speed that brings it there at the
 * union's arrival (#466).
 */
async function joinUnion(p: Player, ships: number): Promise<void> {
  await nav(p.page, 'fleet');
  await expect(union(p.page)).toContainText('Anführer');
  await union(p.page).getByRole('button', { name: 'Beitreten' }).click();
  await expect(p.page.getByLabel('Auftrag')).toHaveValue('attack');
  await expect(p.page.getByLabel('Verband', { exact: true })).not.toHaveValue(
    '',
  );
  await p.page.getByLabel('Anzahl Abfangjäger').fill(String(ships));
  await expect(p.page.locator('#i_arr')).toContainText(
    'Verband: Geschwindigkeit',
  );
  await p.page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(p.page)).toContainText('Flotte unterwegs nach');
}

test.describe('the attack union (#225)', () => {
  test('the invited friend joins the leader, both fleets arrive together and both get the report with the other attacker', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const size = page.viewportSize();
    const target = await defender(browser, size);
    const leader = await join(browser, size, 'Anfuehrer', page);
    const friend = await join(browser, size, 'Beitreter');
    const outsider = await join(browser, size, 'Ohneladung');
    arm(leader.name, 5);
    arm(friend.name, 3);
    arm(outsider.name, 1);
    await befriend(leader, friend);
    await befriend(leader, outsider);

    await sturmangriff(leader, target, 5);
    // Nobody but the leader sees the union before it is opened and invited to.
    await nav(friend.page, 'fleet');
    await expect(union(friend.page)).toHaveCount(0);
    await openAndInvite(leader, friend);
    await expect(
      leader.page.getByText('Ruft der Anführer seine Flotte zurück', {
        exact: false,
      }),
    ).toBeVisible();

    // The friend without an invitation does not see the union and is refused.
    await outsider.page.reload();
    await nav(outsider.page, 'fleet');
    await expect(union(outsider.page)).toHaveCount(0);
    const id = (await union(leader.page).getAttribute('id'))!.replace(
      /^un_/,
      '',
    );
    await openSystemOf(outsider.page, target.name);
    await (
      await galaxyAction(
        outsider.page,
        galaxyRow(outsider.page, target.name),
        'Sturmangriff',
      )
    ).click();
    await expect(
      outsider.page.getByLabel('Verband', { exact: true }),
    ).toHaveCount(0);
    const refused = await outsider.page.evaluate(async (union) => {
      const value = (i: string) =>
        Number((document.getElementById(i) as HTMLInputElement).value);
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'send',
          ships: { lf: 1 },
          to: { g: value('t_g'), s: value('t_s'), p: value('t_p') },
          mission: 'attack',
          pct: 10,
          cargo: { m: 0, c: 0, d: 0 },
          union,
        }),
      });
      return {
        status: r.status,
        error: ((await r.json()) as { error?: string }).error,
      };
    }, id);
    expect(refused.status).toBe(400);
    expect(refused.error).toContain('eingeladen');

    // The invited friend joins; the box of both shows both fleets.
    await friend.page.reload();
    await joinUnion(friend, 3);
    await expect(union(friend.page)).toContainText(friend.name);
    await expect(
      friend.page.locator('.fl-attack').filter({ hasText: 'Angriffsverband' }),
    ).toHaveCount(1);
    await leader.page.reload();
    await nav(leader.page, 'fleet');
    await expect(union(leader.page)).toContainText(leader.name);
    await expect(union(leader.page)).toContainText(friend.name);

    // Both fleets are due together: landing the leader's fleet fights for both.
    seed({ name: leader.name, landFleet: 'attack' });
    seed({ name: friend.name, landFleet: 'attack' });
    for (const [me, other] of [
      [leader, friend],
      [friend, leader],
    ] as const) {
      await nav(me.page, 'messages');
      const battle = report(me.page, /^Kampfbericht .* – gewonnen/);
      await expect(battle).toBeVisible({ timeout: 15000 });
      await battle.locator('.t').click();
      await expect(battle).toContainText(
        'Der Angreifer hat die Schlacht gewonnen!',
      );
      await expect(battle).toContainText(other.name);
    }
    // The defender gets one report that names both attackers.
    await nav(target.page, 'messages');
    const hit = report(target.page, /^Feindkontakt!/);
    await expect(hit).toBeVisible({ timeout: 15000 });
    await expect(hit.locator('.t')).toContainText(leader.name);
    await expect(hit.locator('.t')).toContainText(friend.name);
    for (const p of [target, leader, friend, outsider])
      expect(p.problems).toEqual([]);
  });
});

for (const phone of ['', ' @phone'])
  test(`the recall of the leader turns back every fleet of the union${phone}`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const size = page.viewportSize();
    const target = await defender(browser, size);
    const leader = await join(browser, size, 'Rueckruf', page);
    const friend = await join(browser, size, 'Mitflieger');
    arm(leader.name, 5);
    arm(friend.name, 3);
    await befriend(leader, friend);
    await sturmangriff(leader, target, 5);
    await openAndInvite(leader, friend);
    await friend.page.reload();
    await joinUnion(friend, 3);
    await expect(
      friend.page
        .locator('.fl-attack')
        .filter({ hasText: 'im Angriffsverband' }),
    ).toHaveCount(1);

    // The leader recalls the fleet that opened the union.
    await leader.page.reload();
    await nav(leader.page, 'fleet');
    const lead = leader.page
      .getByRole('row')
      .filter({ hasText: 'Angriffsverband (Anführer)' });
    await lead.getByRole('button', { name: 'Rückruf' }).click();
    await expect(leader.page.locator('.fl-back')).toHaveCount(1);
    await expect(leader.page.locator('.fl-attack')).toHaveCount(0);
    await expect(union(leader.page)).toHaveCount(0);

    // The friend's fleet turns back too, and the friend is told why.
    await friend.page.reload();
    await nav(friend.page, 'fleet');
    await expect(friend.page.locator('.fl-back')).toHaveCount(1);
    await expect(friend.page.locator('.fl-attack')).toHaveCount(0);
    await expect(union(friend.page)).toHaveCount(0);
    await nav(friend.page, 'messages');
    await expect(
      report(friend.page, /^Angriffsverband aufgelöst/),
    ).toBeVisible();
    for (const p of [target, leader, friend]) expect(p.problems).toEqual([]);
  });
