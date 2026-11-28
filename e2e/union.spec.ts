// The attack union (#225, #466, okf/features/holding-acs.md): the leader
// plans a union in the fleet form with his own Sturmangriff and an arrival
// („Neuen Verband planen“, #466, A1a) and invites a friend, who joins from
// the box „Verbandsangriff“ with „Beitreten“ at the speed that brings his
// fleet there at that arrival; the fleets arrive together and both owners get the report of the battle with
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
 * The arrival of a planned union, 30 minutes from now, as the field takes it
 * (local date and time): within the speeds of every fleet of a test, whose
 * players live in one system (a flight there takes about 10 minutes at
 * 100 % and 100 at 10 % in the universe of the specs, tempo 5).
 */
const arrivalIn30Minutes = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const t = new Date(Date.now() + 30 * 60_000);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}T${two(t.getHours())}:${two(t.getMinutes())}`;
  });

/**
 * The leader plans a union on the home planet of `target` with a Sturmangriff
 * of `ships` Abfangjäger (#466): „Neuen Verband planen“, the arrival, and the
 * speed the form shows for it.
 */
async function plan(p: Player, target: Player, ships: number): Promise<void> {
  await openSystemOf(p.page, target.name);
  await (
    await galaxyAction(p.page, galaxyRow(p.page, target.name), 'Sturmangriff')
  ).click();
  await expect(p.page.getByLabel('Auftrag')).toHaveValue('attack');
  await p.page.getByLabel('Anzahl Abfangjäger').fill(String(ships));
  await p.page
    .getByLabel('Verband', { exact: true })
    .selectOption({ label: 'Neuen Verband planen' });
  // Another mission drops the plan, and nothing hidden is sent (review of
  // #473); a Sturmangriff offers it again.
  await p.page.getByLabel('Auftrag').selectOption('transport');
  await expect(p.page.getByLabel('Ankunft des Verbands')).toHaveCount(0);
  await expect(p.page.getByLabel('Verband', { exact: true })).toHaveCount(0);
  await p.page.getByLabel('Auftrag').selectOption('attack');
  await expect(p.page.getByLabel('Verband', { exact: true })).toHaveValue(
    'plan',
  );
  await p.page
    .getByLabel('Ankunft des Verbands')
    .fill(await arrivalIn30Minutes(p.page));
  await expect(p.page.locator('#i_arr')).toContainText(
    'Verband: Geschwindigkeit',
  );
  await p.page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(p.page)).toContainText('Flotte unterwegs nach');
}

/**
 * The arrival of a planned union six hours from now, as the field takes it:
 * later than any fleet of a test reaches at 10 % (about 100 minutes), so the
 * leader's fleet starts later by itself (#478).
 */
const arrivalIn6Hours = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const t = new Date(Date.now() + 6 * 3_600_000);
    const two = (n: number) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${two(t.getMonth() + 1)}-${two(t.getDate())}T${two(t.getHours())}:${two(t.getMinutes())}`;
  });

/**
 * The leader plans a union six hours ahead (#478): the form names the later
 * start, the fleet stays, the answer names start and arrival.
 */
async function planLater(
  p: Player,
  target: Player,
  ships: number,
): Promise<void> {
  await openSystemOf(p.page, target.name);
  await (
    await galaxyAction(p.page, galaxyRow(p.page, target.name), 'Sturmangriff')
  ).click();
  await p.page.getByLabel('Anzahl Abfangjäger').fill(String(ships));
  await p.page
    .getByLabel('Verband', { exact: true })
    .selectOption({ label: 'Neuen Verband planen' });
  await p.page
    .getByLabel('Ankunft des Verbands')
    .fill(await arrivalIn6Hours(p.page));
  await expect(p.page.locator('#i_arr')).toContainText('Verband: Start am');
  await p.page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(p.page)).toContainText(
    'Sturmangriff geplant: Start am',
  );
}

/** The box of a union in the fleet view; `.union` is its row. */
const union = (page: Page): Locator => page.locator('#view .union');

/** The leader invites `invited` to the union he planned. */
async function invite(leader: Player, invited: Player): Promise<void> {
  const { page } = leader;
  await nav(page, 'fleet');
  await expect(page.getByText('Angriffsverband eröffnen')).toHaveCount(0);
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

    await plan(leader, target, 5);
    // Nobody but the leader sees the union before he invites to it.
    await nav(friend.page, 'fleet');
    await expect(union(friend.page)).toHaveCount(0);
    await invite(leader, friend);
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
    // His row „Verband“ offers only to plan a union of his own (#466).
    await expect(
      outsider.page.getByLabel('Verband', { exact: true }).locator('option'),
    ).toHaveText(['Kein Verband', 'Neuen Verband planen']);
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
    await plan(leader, target, 5);
    await invite(leader, friend);
    await friend.page.reload();
    await joinUnion(friend, 3);
    await expect(
      friend.page
        .locator('.fl-attack')
        .filter({ hasText: 'im Angriffsverband' }),
    ).toHaveCount(1);

    // The leader recalls the fleet that leads the union.
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

test.describe('a later start of the leader (#478)', () => {
  test('the fleet stays until its planned start, which the movements and the box show, and then starts by itself', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const size = page.viewportSize();
    const target = await defender(browser, size);
    const leader = await join(browser, size, 'Spaeter', page);
    arm(leader.name, 5);
    await planLater(leader, target, 4);
    await nav(leader.page, 'fleet');
    const planned = leader.page
      .locator('#view tr')
      .filter({ hasText: 'Geplanter Start' });
    await expect(planned).toContainText('Deine Flotte (4 ');
    await expect(
      planned.getByRole('button', { name: 'Abbrechen' }),
    ).toBeVisible();
    await expect(union(leader.page)).toContainText(
      'Start der Flotte des Anführers in',
    );
    // The ships it holds back are not free: one of five is left for the form.
    await expect(
      leader.page
        .locator('#view tr')
        .filter({ has: leader.page.getByLabel('Anzahl Abfangjäger') })
        .locator('td.n')
        .first(),
    ).toHaveText('1');
    seed({ name: leader.name, startPlanned: true });
    await expect
      .poll(
        async () => {
          await leader.page.reload();
          await nav(leader.page, 'fleet');
          return leader.page
            .locator('.fl-attack')
            .filter({ hasText: 'Angriffsverband (Anführer)' })
            .filter({ hasNotText: 'Geplanter Start' })
            .count();
        },
        { timeout: 15_000 },
      )
      .toBe(1);
    await expect(
      leader.page.locator('#view tr').filter({ hasText: 'Geplanter Start' }),
    ).toHaveCount(0);
    expect(leader.problems).toEqual([]);
  });

  test('„Abbrechen“ of the planned start dissolves the union', async ({
    page,
    browser,
  }) => {
    const size = page.viewportSize();
    const target = await defender(browser, size);
    const leader = await join(browser, size, 'Abbrecher', page);
    arm(leader.name, 3);
    await planLater(leader, target, 2);
    await nav(leader.page, 'fleet');
    await leader.page
      .locator('#view tr')
      .filter({ hasText: 'Geplanter Start' })
      .getByRole('button', { name: 'Abbrechen' })
      .click();
    await expect(lastToast(leader.page)).toContainText(
      'Geplanter Start abgebrochen.',
    );
    await expect(
      leader.page.locator('#view tr').filter({ hasText: 'Geplanter Start' }),
    ).toHaveCount(0);
    await expect(union(leader.page)).toHaveCount(0);
    expect(leader.problems).toEqual([]);
  });
});
