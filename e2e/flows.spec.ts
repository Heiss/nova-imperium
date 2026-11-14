// The game flows of #68 that had no browser test, and the admin event log of
// a battle (#151). Flights and the shipyard
// are moved forward with e2e/seed.ts; the mails go through the mail sink of
// the second server (e2e/env.ts, e2e/mail.ts).
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  choosePlanet,
  cli,
  emailOf,
  galaxyRow,
  login,
  loginByCode,
  mail,
  mailCli,
  mailSeed,
  nav,
  register,
  registerByMail,
  seed,
  stock,
  uniqueName,
  watch,
} from './helpers.ts';
import { E2E_MAIL_URL } from './env.ts';

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

/** The count of a ship in the fleet view of the active planet. */
const shipCount = (page: Page, ship: string): Locator =>
  page
    .locator('tr')
    .filter({ has: page.locator('input.fs'), hasText: ship })
    .locator('td.n')
    .first();

const lastToast = (page: Page): Locator => page.locator('.toast').last();
const report = (page: Page, title: string | RegExp): Locator =>
  page.locator('.rep').filter({ has: page.locator('.t', { hasText: title }) });

/** Sends a Frachtläufer with 1,000 Adamant to the own colony on slot 15. */
async function sendTransport(page: Page): Promise<void> {
  await page.goto('/?view=fleet');
  await page.getByLabel('Anzahl Frachtläufer').fill('1');
  await page.getByLabel('Position', { exact: true }).fill('15');
  await page.getByLabel('Auftrag').selectOption('transport');
  await page.locator('#c_m').fill('1000');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
  await expect(page.locator('.fl-transport')).toContainText('1 Frachtläufer');
}

/**
 * Registers a defender and an attacker; the attacker (logged in afterwards)
 * sends 5 Abfangjäger and 2 Frachtläufer against the defender's home planet,
 * and the fleet arrives now.
 */
async function attack(page: Page, a: string, b: string): Promise<void> {
  await register(page, b);
  await page.click('[data-act=logout]');
  await register(page, a);
  seed({ name: a, ships: { lf: 5, sc: 2 }, res: { m: 0, c: 0, d: 10000 } });
  // Mines and a probe give the defender a fifth of the attacker's points
  // (no noob protection); the probe dies in the first round.
  seed({
    name: b,
    b: { metal: 12, crystal: 10 },
    ships: { probe: 1 },
    res: { m: 50000, c: 50000, d: 50000 },
  });
  await openSystemOf(page, b);
  await expect(galaxyRow(page, b)).not.toContainText('(n)');
  await galaxyRow(page, b).getByText('Sturmangriff').click();
  await expect(page.getByLabel('Auftrag')).toHaveValue('attack');
  await page.getByLabel('Anzahl Abfangjäger').fill('5');
  await page.getByLabel('Anzahl Frachtläufer').fill('2');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
  await expect(page.locator('.fl-attack')).toContainText('Sturmangriff');
  seed({ name: a, landFleet: 'attack' });
}

test.describe('fleet and battle (#68)', () => {
  test('an attack wins the battle, takes loot home and leaves reports for both sides', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Sturm');
    const b = uniqueName('Beute');
    await attack(page, a, b);
    const badge = page.locator('#menu [data-v=messages] .badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.fl-back')).toContainText('kehrt von');
    await nav(page, 'messages');
    await expect(badge).toHaveCount(0);
    const battle = report(page, /^Kampfbericht .* – gewonnen/);
    await battle.locator('.t').click();
    await expect(battle).toContainText('1 Runde(n)');
    await expect(battle).toContainText(
      'Der Angreifer hat die Schlacht gewonnen!',
    );
    await expect(battle.locator('tr', { hasText: 'Spähschädel' })).toHaveText(
      /Spähschädel\s*1\s*0\s*1/,
    );
    // Holds of 5 × 50 + 2 × 5,000 = 10,250: a third Adamant, then half of the
    // rest Psikristall, the rest Promethium (plunder in arrival.ts).
    const loot = 'Adamant 3.416 · Psikristall 3.417 · Promethium 3.417';
    await expect(battle).toContainText(`Erbeutet: ${loot}`);

    seed({ name: a, returnFleet: true });
    const home = report(page, 'Rückkehr zu');
    await expect(home).toBeVisible({ timeout: 15000 });
    await home.locator('.t').click();
    await expect(home).toContainText(
      `Deine Flotte ist zurück und bringt ${loot} mit.`,
    );
    await expect(stock(page, 'Adamant')).toHaveText(/^3\.41\d$/);

    await page.click('[data-act=logout]');
    await login(page, b);
    await expect(badge).toBeVisible();
    await nav(page, 'messages');
    const hit = report(page, `Feindkontakt! Heimatplanet`);
    await hit.locator('.t').click();
    await expect(hit).toContainText(`angegriffen`);
    await expect(hit).toContainText(`Erbeutet: ${loot}`);
    expect(w.problems).toEqual([]);
  });

  test('a battle leaves a Trümmerfeld that every player sees; a Bergung takes it home (#45)', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Berger');
    const b = uniqueName('Wrack');
    await attack(page, a, b);
    // The Spähschädel (0 / 1,000 / 0) dies: 30 % of it lies at the position.
    const field = 'Trümmerfeld: 0 Adamant, 300 Psikristall';
    const badge = page.locator('#menu [data-v=messages] .badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await nav(page, 'messages');
    const battle = report(page, /^Kampfbericht .* – gewonnen/);
    await battle.locator('.t').click();
    await expect(battle).toContainText(
      'Es entstand ein Trümmerfeld mit 0 Adamant und 300 Psikristall.',
    );
    seed({ name: a, returnFleet: true });
    const returns = report(page, 'Rückkehr zu');
    await expect(returns).toHaveCount(1, { timeout: 15000 });

    // The defender sees the field at his own planet too.
    await page.click('[data-act=logout]');
    await login(page, b);
    await page.goto('/?view=galaxy');
    await page.getByText('zum Heimatsystem').click();
    await expect(
      galaxyRow(page, b).getByRole('img', { name: field }),
    ).toBeVisible();
    await expect(
      galaxyRow(page, b).getByRole('button', { name: 'Bergung' }),
    ).toBeVisible();

    await page.click('[data-act=logout]');
    seed({
      name: a,
      ships: { recycler: 1, lc: 1 },
      res: { m: 0, c: 0, d: 10000 },
    });
    await login(page, a);
    await openSystemOf(page, b);
    const row = galaxyRow(page, b);
    await expect(row.getByRole('img', { name: field })).toHaveAttribute(
      'title',
      field,
    );
    await row.getByRole('button', { name: 'Bergung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('harvest');
    await expect(page.locator('#t_info')).toHaveText(field);
    // A Lastbarke alone may not fly to a Bergung.
    await page.getByLabel('Anzahl Lastbarke').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText(
      'Du brauchst eine Bergungsbarke.',
    );
    await page.getByLabel('Anzahl Bergungsbarke').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await expect(page.locator('.fl-harvest')).toContainText('1 Bergungsbarke');

    seed({ name: a, landFleet: 'harvest' });
    await expect(page.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });
    await nav(page, 'messages');
    const harvested = report(page, /^Bergung erreicht/);
    await harvested.locator('.t').click();
    await expect(harvested).toContainText(
      'Deine Bergungsbarken haben 0 Adamant und 300 Psikristall geborgen.',
    );
    // The field is gone for everybody.
    await openSystemOf(page, b);
    await expect(galaxyRow(page, b).locator('img.debris')).toHaveCount(0);
    await expect(
      galaxyRow(page, b).getByRole('button', { name: 'Bergung' }),
    ).toHaveCount(0);

    seed({ name: a, returnFleet: true });
    await nav(page, 'messages');
    await expect(returns).toHaveCount(2, { timeout: 15000 });
    await returns.first().locator('.t').click();
    await expect(returns.first()).toContainText(
      'Deine Flotte ist zurück und bringt Adamant 0 · Psikristall 300 · Promethium 0 mit.',
    );
    expect(w.problems).toEqual([]);
  });

  test('the Sternenkarte shows a Trümmerfeld with „Bergung“ on a phone (#45) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('BergH');
    const b = uniqueName('WrackH');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    seed({ name: b, debris: { m: 1800, c: 600 } });
    seed({ name: a, ships: { recycler: 1 } });
    await page.reload();
    await openSystemOf(page, b);
    const row = galaxyRow(page, b);
    await expect(
      row.getByRole('img', {
        name: 'Trümmerfeld: 1.800 Adamant, 600 Psikristall',
      }),
    ).toBeVisible();
    await expect(row.getByRole('button', { name: 'Bergung' })).toBeVisible();
    // Against the device width: a too wide table also widens innerWidth.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    await row.getByRole('button', { name: 'Bergung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('harvest');
    expect(w.problems).toEqual([]);
  });

  test('a transport unloads on the colony and comes home; reports are deleted one by one and all at once', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Fracht');
    await register(page, name);
    seed({
      name,
      ships: { sc: 1 },
      res: { m: 5000, c: 0, d: 5000 },
      colony: { res: { m: 0, c: 0, d: 0 } },
    });
    await sendTransport(page);
    await expect(stock(page, 'Adamant')).toHaveText(/^4\.\d{3}$/);

    seed({ name, landFleet: 'transport' });
    await expect(page.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });
    await choosePlanet(page, 'Kolonie');
    await expect(stock(page, 'Adamant')).toHaveText('1.000');
    seed({ name, returnFleet: true });
    await nav(page, 'messages');
    await expect(page.locator('.box .hd')).toContainText('Berichte (2)', {
      timeout: 15000,
    });
    const arrived = report(page, 'Transport erreicht');
    await arrived.locator('.t').click();
    await expect(arrived).toContainText(
      'und liefert Adamant 1.000 · Psikristall 0 · Promethium 0.',
    );
    const back = report(page, 'Rückkehr zu Heimatplanet');
    await back.locator('.t').click();
    await expect(back).toContainText('Deine Flotte ist zurück.');

    await back.getByText('löschen', { exact: true }).click();
    await expect(page.locator('.box .hd')).toContainText('Berichte (1)');
    await expect(back).toHaveCount(0);
    await expect(arrived).toBeVisible();
    await page.getByRole('button', { name: 'Alle löschen' }).click();
    await expect(page.locator('.box .hd')).toContainText('Berichte (0)');
    await expect(page.getByText('Keine Nachrichten.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Keine Nachrichten.')).toBeVisible();
    expect(w.problems).toEqual([]);
  });

  test('„Rückruf“ turns a transport back; it brings its cargo home', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Rueckruf');
    await register(page, name);
    seed({
      name,
      ships: { sc: 1 },
      res: { m: 5000, c: 0, d: 5000 },
      colony: { res: { m: 0, c: 0, d: 0 } },
    });
    await sendTransport(page);
    await page.getByRole('button', { name: 'Rückruf' }).click();
    await expect(lastToast(page)).toContainText('Flotte zurückgerufen.');
    await expect(page.locator('.fl-back')).toContainText('kehrt von');
    await expect(page.locator('.fl-transport')).toHaveCount(0);

    seed({ name, returnFleet: true });
    await expect(page.locator('.fl-back')).toHaveCount(0, { timeout: 15000 });
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('1');
    await nav(page, 'messages');
    await expect(page.locator('.box .hd')).toContainText('Berichte (1)');
    const back = report(page, 'Rückkehr zu Heimatplanet');
    await back.locator('.t').click();
    await expect(back).toContainText(
      'Deine Flotte ist zurück und bringt Adamant 1.000 · Psikristall 0 · Promethium 0 mit.',
    );
    await choosePlanet(page, 'Kolonie');
    await expect(stock(page, 'Adamant')).toHaveText('0');
    expect(w.problems).toEqual([]);
  });

  test('the fleet form: max, all and no ships, „alles“ cargo, too little Promethium, all fleet slots used', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Slots');
    await register(page, name);
    seed({
      name,
      ships: { sc: 2, lf: 3 },
      res: { m: 6000, c: 50000, d: 0 },
      colony: {},
    });
    await page.goto('/?view=fleet');
    await expect(page.locator('.box .hd').first()).toHaveText(
      'Flotten unterwegs (0 / 1 Slots)',
    );
    const sc = page.getByLabel('Anzahl Frachtläufer');
    const lf = page.getByLabel('Anzahl Abfangjäger');
    await page.locator('[data-act=fmax][data-k=sc]').click();
    await expect(sc).toHaveValue('2');
    await expect(lf).toHaveValue('');
    await page.getByText('alle Schiffe', { exact: true }).click();
    await expect(lf).toHaveValue('3');
    await page.getByText('keine Schiffe', { exact: true }).click();
    await expect(sc).toHaveValue('');
    await expect(lf).toHaveValue('');
    await page.getByText('alle Schiffe', { exact: true }).click();
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    // Holds of 2 × 5,000 + 3 × 50: all the Adamant, Psikristall for the rest.
    await page.getByText('alles', { exact: true }).click();
    await expect(page.getByLabel('Adamant', { exact: true })).toHaveValue(
      '6000',
    );
    await expect(page.getByLabel('Psikristall', { exact: true })).toHaveValue(
      '4150',
    );
    await expect(page.getByLabel('Promethium', { exact: true })).toHaveValue(
      '0',
    );
    await expect(page.locator('#i_cap')).toHaveText('10.150 / 10.150');
    await expect(page.locator('#i_fuel .bad')).toBeVisible();
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Nicht genug Promethium für Treibstoff und Ladung.',
    );
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('2');

    seed({ name, res: { m: 6000, c: 50000, d: 1000 } });
    await page.reload();
    await sc.fill('1');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_fuel .bad')).toHaveCount(0);
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    // Kogitator-Doktrin 0: one slot.
    await expect(page.locator('.box .hd').first()).toHaveText(
      'Flotten unterwegs (1 / 1 Slots)',
    );
    await expect(
      page.getByRole('button', { name: 'Flotte losschicken' }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        'Alle Flottenslots belegt (Kogitator-Doktrin erhöht die Anzahl).',
      ),
    ).toBeVisible();
    // A second flight, as from another device that still shows the button.
    const refused = await page.evaluate(async () => {
      const value = (id: string) =>
        Number((document.getElementById(id) as HTMLInputElement).value);
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'send',
          ships: { lf: 1 },
          to: { g: value('t_g'), s: value('t_s'), p: 15 },
          mission: 'transport',
          pct: 10,
          cargo: { m: 0, c: 0, d: 0 },
        }),
      });
      return ((await r.json()) as { error?: string }).error;
    });
    expect(refused).toBe('Alle Flottenslots belegt.');
    expect(w.problems).toEqual([]);
  });

  test('noob protection (n) blocks spying on and attacking a much weaker player', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Riese');
    const b = uniqueName('Zwerg');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    // 22 points against the 0 of a new player: less than a fifth.
    seed({
      name: a,
      ships: { probe: 2, lf: 5 },
      res: { d: 10000, m: 0, c: 0 },
    });
    await openSystemOf(page, b);
    const row = galaxyRow(page, b);
    await expect(row.getByTitle('Noobschutz')).toHaveText('(n)');
    await row.getByText('Auspex-Erkundung').click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Dieser Spieler steht unter Noobschutz.',
    );
    await row.getByText('Sturmangriff').click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('attack');
    await page.getByLabel('Anzahl Abfangjäger').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Dieser Spieler steht unter Noobschutz.',
    );
    await expect(page.locator('.box .hd').first()).toHaveText(
      'Flotten unterwegs (0 / 1 Slots)',
    );
    expect(w.problems).toEqual([]);
  });
});

test.describe('galaxy, shipyard and options (#68)', () => {
  test('galaxy: ◀ ▶ step through galaxies and systems, Enter shows a typed system, „zum Heimatsystem“ and „Wechseln“', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Karte');
    await register(page, name);
    seed({ name, colony: {} });
    // A second colony far away shows that Enter loads the typed system.
    const far = uniqueName('Fern');
    seed({ name, colony: { g: 2, s: 7, p: 15, name: far } });
    const farRow = page.locator('table.gal tr', { hasText: far });
    await page.goto('/?view=galaxy');
    await expect(page.locator('#pinfo')).toContainText(/\[\d+:\d+:\d+\]/);
    const [, g, s] = /\[(\d+):(\d+):\d+\]/.exec(
      (await page.locator('#pinfo').textContent())!,
    )!;
    const gal = page.getByLabel('Galaxie', { exact: true });
    const sys = page.getByLabel('System', { exact: true });
    await expect(gal).toHaveValue(g!);
    await expect(sys).toHaveValue(s!);
    await gal.fill('1');
    await sys.fill('1');
    await sys.press('Enter');
    await expect(sys).toHaveValue('1');
    // Galaxies stop at the ends, systems wrap around (galaxyStep).
    await page.getByRole('button', { name: 'vorige Galaxie' }).click();
    await expect(gal).toHaveValue('1');
    await page.getByRole('button', { name: 'nächste Galaxie' }).click();
    await expect(gal).toHaveValue('2');
    await page.getByRole('button', { name: 'voriges System' }).click();
    await expect(sys).toHaveValue('50');
    await page.getByRole('button', { name: 'nächstes System' }).click();
    await expect(sys).toHaveValue('1');
    await sys.fill('7');
    await expect(farRow).toHaveCount(0);
    await sys.press('Enter');
    await expect(sys).toHaveValue('7');
    await expect(gal).toHaveValue('2');
    await expect(farRow).toContainText(name);
    await expect(farRow.locator('td.n')).toHaveText('15');
    await page.getByText('zum Heimatsystem').click();
    await expect(gal).toHaveValue(g!);
    await expect(sys).toHaveValue(s!);
    const colony = page.locator('tr.me', { hasText: 'Kolonie' });
    await colony.getByRole('button', { name: 'Wechseln' }).click();
    await expect(page.locator('#pinfo b').first()).toHaveText('Kolonie');
    await expect(colony).toContainText('Aktiver Planet');
    await expect(
      page
        .locator('tr.me', { hasText: 'Heimatplanet' })
        .getByRole('button', { name: 'Wechseln' }),
    ).toBeVisible();
    expect(w.problems).toEqual([]);
  });

  test('the shipyard max button fills the order; the queue finishes unit by unit', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Werft');
    await register(page, name);
    // Abfangjäger cost 3,000 Adamant and 1,000 Psikristall: two can be paid.
    seed({
      name,
      b: { robot: 2, yard: 2 },
      research: { comb: 1 },
      res: { m: 7000, c: 2500, d: 0 },
    });
    await page.goto('/?view=shipyard');
    const fighter = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Abfangjäger/ }),
    });
    const max = fighter.locator('[data-act=maxq]');
    await expect(max).toHaveText('(max 2)');
    await max.click();
    await expect(page.locator('#q_lf')).toHaveValue('2');
    await fighter.getByRole('button', { name: 'Bauen' }).click();
    await expect(lastToast(page)).toContainText(
      '2× Abfangjäger in Auftrag gegeben.',
    );
    const queue = page.locator('.box', {
      hasText: 'Bauauftrag der Schiffsschmiede',
    });
    await expect(queue).toContainText('2× Abfangjäger');
    await expect(queue).toContainText('nächste fertig in');
    await expect(max).toHaveText('(max 0)');
    await expect(fighter.locator('.lv')).toHaveText('(vorhanden: 0)');

    seed({ name, finishUnits: 1 });
    await page.reload();
    await expect(queue).toContainText('1× Abfangjäger');
    await expect(queue).toContainText('nächste fertig in');
    await expect(fighter.locator('.lv')).toHaveText('(vorhanden: 1)');
    seed({ name, finishUnits: 2 });
    await page.reload();
    await expect(fighter.locator('.lv')).toHaveText('(vorhanden: 2)');
    await expect(queue).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });

  test('„Spähschädel pro Auspex-Erkundung“ is saved and sent by the galaxy spy button', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Spaeher');
    const b = uniqueName('Nachbar');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    seed({ name: a, ships: { probe: 5 }, res: { m: 0, c: 0, d: 10000 } });
    seed({ name: b, b: { metal: 10 } });
    await nav(page, 'help');
    const probes = page.getByLabel('Spähschädel pro Auspex-Erkundung');
    await expect(probes).toHaveValue('1');
    await probes.fill('3');
    await page.click('[data-act=saveopt]');
    await expect(lastToast(page)).toContainText('Gespeichert.');
    await page.reload();
    await expect(probes).toHaveValue('3');
    await openSystemOf(page, b);
    await expect(
      page.getByText('Auspex-Erkundung schickt 3 Spähschädel'),
    ).toBeVisible();
    await galaxyRow(page, b).getByText('Auspex-Erkundung').click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await nav(page, 'fleet');
    await expect(page.locator('.fl-spy')).toContainText('3 Spähschädel');
    await expect(shipCount(page, 'Spähschädel')).toHaveText('2');
    expect(w.problems).toEqual([]);
  });
});

test.describe('guilds (#68)', () => {
  test('apply, decline and accept, transfer the lead, leave and remove a member', async ({
    page,
    browser,
  }) => {
    const founder = uniqueName('Leiter');
    const a = uniqueName('Erbe');
    const b = uniqueName('Gast');
    const tag = `G${Date.now() % 1000000}`;
    const title = `[${tag}] Gilde ${tag}`;
    const w = watch(page);
    await register(page, founder);
    await nav(page, 'guilds');
    await page.getByLabel('Kürzel').fill(tag);
    await page.getByLabel('Name', { exact: true }).fill(`Gilde ${tag}`);
    await page.getByRole('button', { name: 'Gilde gründen' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const apply = async (p: Page): Promise<void> => {
      await nav(p, 'guilds');
      await p.getByRole('link', { name: title }).click();
      await p.getByRole('button', { name: 'Bewerben' }).click();
      await expect(lastToast(p)).toContainText('Bewerbung gesendet.');
      await expect(p.getByText('Deine Bewerbung ist offen.')).toBeVisible();
    };
    const pa = await browser.newPage();
    const wa = watch(pa);
    await register(pa, a);
    await apply(pa);
    const pb = await browser.newPage();
    const wb = watch(pb);
    await register(pb, b);
    await apply(pb);

    const confirm = (p: Page): void =>
      void p.once('dialog', (dialog) => void dialog.accept());
    const member = (p: Page, n: string): Locator =>
      p
        .locator('tr')
        .filter({ has: p.getByRole('cell', { name: n, exact: true }) });
    const applicant = (p: Page, n: string): Locator =>
      p.locator('p', { hasText: n });
    await page.reload();
    await applicant(page, b).getByRole('button', { name: 'Ablehnen' }).click();
    await expect(lastToast(page)).toContainText('Bewerbung abgelehnt.');
    await applicant(page, a).getByRole('button', { name: 'Annehmen' }).click();
    await expect(lastToast(page)).toContainText('Bewerbung angenommen.');
    await expect(page.getByText('Keine offenen Bewerbungen.')).toBeVisible();
    await expect(member(page, a)).toContainText('Mitglied');
    confirm(page);
    await member(page, a)
      .getByRole('button', { name: 'Leitung übergeben' })
      .click();
    await expect(lastToast(page)).toContainText('Gildenleitung übergeben.');
    await expect(member(page, a)).toContainText('Leitung');
    await expect(member(page, founder)).toContainText('Mitglied');
    confirm(page);
    await page.getByRole('button', { name: 'Gilde verlassen' }).click();
    await expect(lastToast(page)).toContainText('Gilde verlassen.');
    await expect(member(page, founder)).toHaveCount(0);

    await pb.reload();
    await expect(pb.getByText('Deine Bewerbung ist offen.')).toHaveCount(0);
    await pb.getByRole('button', { name: 'Bewerben' }).click();
    await expect(lastToast(pb)).toContainText('Bewerbung gesendet.');
    await pa.reload();
    await applicant(pa, b).getByRole('button', { name: 'Annehmen' }).click();
    await expect(member(pa, b)).toContainText('Mitglied');
    confirm(pa);
    await member(pa, b).getByRole('button', { name: 'Entfernen' }).click();
    await expect(lastToast(pa)).toContainText('Mitglied entfernt.');
    await expect(member(pa, b)).toHaveCount(0);
    await pb.reload();
    await expect(pb.getByRole('button', { name: 'Bewerben' })).toBeVisible();
    await pa.close();
    await pb.close();
    expect([...w.problems, ...wa.problems, ...wb.problems]).toEqual([]);
  });
});

test.describe('accounts by mail (#68)', () => {
  test('a login needs the code from the mail; a wrong code is refused', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Code');
    await registerByMail(page, name);
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');
    const [, code] = await mail(emailOf(name), /Anmeldecode lautet (\d{6})\./);
    const wrong = code!.replace(/\d$/, (d) => String((Number(d) + 1) % 10));
    const field = page.getByLabel('Sechsstelliger Code aus deiner E-Mail');
    await field.fill(wrong);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Der Anmeldecode ist ungültig oder abgelaufen.',
    );
    await field.fill(code!);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('h2')).toContainText('Übersicht');
    await expect(page.locator('#pinfo')).toContainText(name);
    expect(w.problems).toEqual([]);
  });

  test('„Passwort vergessen“ sends a link that sets a new password once', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Vergessen');
    await registerByMail(page, name);
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click();
    await page
      .getByLabel('Hinterlegte E-Mail-Adresse')
      .fill(emailOf(name).toUpperCase());
    await page.getByRole('button', { name: 'Link anfordern' }).click();
    await expect(lastToast(page)).toContainText(
      'Falls die Adresse hinterlegt ist, erhältst du einen Link per E-Mail.',
    );
    const [link] = await mail(emailOf(name), /http:\S+#reset=[\w-]{43}/);
    expect(link.startsWith(`${E2E_MAIL_URL}/#reset=`)).toBe(true);
    await page.goto('about:blank');
    await page.goto(link);
    await expect(page.locator('.auth .hd')).toHaveText(
      'Neues Passwort festlegen',
    );
    await page.getByLabel('Neues Passwort').fill('ein-neues-testpasswort');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(lastToast(page)).toContainText(
      'Passwort gespeichert. Melde dich mit deinem neuen Passwort an.',
    );
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(page.locator('.toast.err').last()).toHaveText(
      'Name oder Passwort falsch.',
    );
    await loginByCode(page, name, 'ein-neues-testpasswort');

    await page.goto('about:blank');
    await page.goto(link);
    await page.getByLabel('Neues Passwort').fill('ein-drittes-testpasswort');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Dieser Link ist ungültig oder abgelaufen.',
    );
    expect(w.problems).toEqual([]);
  });
});

test.describe('admin (#68)', () => {
  test('the admin copies an invitation link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const w = watch(page);
    const name = uniqueName('Kopierer');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Einladungen' }).click();
    // Not „…freund@example.org“: the admin test of game.spec.ts finds its own
    // invitation by that text.
    const email = `einladung-${name.toLowerCase()}@example.org`;
    await page.fill('#inv_email', email);
    await page.click('#inviteform button[type=submit]');
    const link = page.getByLabel('Einladungslink');
    await expect(link).toHaveValue(/#invite=[\w-]{43}$/);
    await page.getByRole('button', { name: 'Kopieren' }).click();
    await expect(lastToast(page)).toHaveText('Link kopiert.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await link.inputValue(),
    );
    const row = page.locator('tr', { hasText: email });
    await row.getByRole('button', { name: 'Widerrufen' }).click();
    await expect(row).toHaveCount(0);
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });

  test('the admin starts a new round: accounts stay, planets and research are new', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Runde');
    await registerByMail(page, name);
    mailCli('admin', name);
    mailSeed({ name, b: { metal: 5, lab: 1 }, research: { energy: 2 } });
    await loginByCode(page, name);
    await nav(page, 'buildings');
    const mine = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Adamant-Tiefbohrung/ }),
    });
    await expect(mine.locator('.lv')).toHaveText('(Stufe 5)');
    const energy = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Machina-Energetik/ }),
    });
    await nav(page, 'research');
    await expect(energy.locator('.lv')).toHaveText('(Stufe 2)');
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page.getByRole('button', { name: 'Neue Runde starten' }).click();
    await expect(
      page.getByText('Wirklich eine neue Runde starten?'),
    ).toBeVisible();
    await expect(page.getByLabel('Tagesbelohnungen aktivieren')).toBeChecked();
    await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
    await expect(lastToast(page)).toContainText(
      'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.',
    );
    await expect(page.locator('#pinfo')).toContainText(name);
    await nav(page, 'buildings');
    await expect(mine.locator('.lv')).toHaveText('');
    await nav(page, 'research');
    await expect(page.locator('.notice')).toHaveText(
      'Für Forschung brauchst du ein Scholarium.',
    );
    // A Scholarium on the new planet shows the research: back to level 0.
    mailSeed({ name, b: { lab: 1 } });
    await page.reload();
    await expect(energy.locator('.lv')).toHaveText('');
    await expect(energy.locator('[data-act=research]')).toHaveText('Forschen');
    mailCli('unadmin', name);
    expect(w.problems).toEqual([]);
  });

  test('the event log filters by a planet or fleet of an event (#151)', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Feldherr');
    const b = uniqueName('Ziel');
    await attack(page, a, b);
    await expect(page.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });
    cli('admin', a);
    await page.reload();
    await nav(page, 'admin');
    const events = page.locator('[data-admin=events]');
    const count = events.getByRole('status');
    await page
      .getByLabel('Spieler', { exact: true })
      .selectOption({ label: a });
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    // Registration, the attack order, the battle and the admin's reads.
    await expect(count).toHaveText(/ · ([3-9]|\d{2,}) Ereignisse$/);
    const row = (action: RegExp) => events.getByRole('row', { name: action });
    const battle = row(/system \/ battle/);
    await battle.getByText(/^Kampfdetails \d+$/).click();
    const detail = JSON.parse(
      await battle.locator('details > code').innerText(),
    ) as { fleet: string; planet: string };
    await expect(
      events.getByRole('button', { name: /^Aufträge zu/ }),
    ).toHaveCount(0);

    // The fleet: its attack order and its battle, long after the order.
    await battle
      .getByRole('button', {
        name: `Ereignisse zu ${detail.fleet}`,
        exact: true,
      })
      .click();
    await expect(page.getByLabel('Planet / Flotte')).toHaveValue(detail.fleet);
    await expect(count).toHaveText('Seite 1 von 1 · 2 Ereignisse');
    await expect(battle).toBeVisible();
    await expect(row(/game \/ send/)).toBeVisible();
    await expect(row(/account \/ register/)).toHaveCount(0);

    // The attacked planet: the same two events of this attacker.
    await battle.getByText(/^Kampfdetails \d+$/).click();
    await battle
      .getByRole('button', {
        name: `Ereignisse zu ${detail.planet}`,
        exact: true,
      })
      .click();
    await expect(page.getByLabel('Planet / Flotte')).toHaveValue(detail.planet);
    await expect(count).toHaveText('Seite 1 von 1 · 2 Ereignisse');
    await expect(battle).toBeVisible();
    await expect(row(/game \/ send/)).toBeVisible();
    cli('unadmin', a);
    expect(w.problems).toEqual([]);
  });
});

test.describe('push and economy (#68)', () => {
  test('browser notifications: this server without Web Push says so; „Deaktivieren“ works', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['notifications']);
    const w = watch(page);
    await register(page, uniqueName('Push'));
    await nav(page, 'help');
    await page.getByRole('button', { name: 'Aktivieren', exact: true }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Browser-Benachrichtigungen sind auf diesem Server deaktiviert.',
    );
    await page
      .getByRole('button', { name: 'Deaktivieren', exact: true })
      .click();
    await expect(lastToast(page)).toHaveText('Benachrichtigungen deaktiviert.');
    expect(w.problems).toEqual([]);
  });

  test('a full store stops its production; too little energy lowers the mines', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Lager');
    await register(page, name);
    // One hour without mines at speed 5: 100 Adamant and 50 Psikristall of
    // base income; the Adamant store (100.000) is full already.
    seed({
      name,
      res: { m: 100000, c: 0, d: 0 },
      settledAgo: 3600 * 1000,
    });
    await page.reload();
    await expect(stock(page, 'Adamant')).toHaveText('100.000');
    await expect(stock(page, 'Adamant')).toHaveClass(/full/);
    await expect(stock(page, 'Psikristall')).toHaveText('50');
    await expect(stock(page, 'Psikristall')).not.toHaveClass(/full/);

    // Mine 10 needs 259 energy, solar 5 gives 161: factor 62 %, Adamant
    // (20 + 30 · 10 · 1.1¹⁰ · 0.62) · 5 = 2,515 per hour; solar 7 gives 272.
    const sum = page.locator('tr', { hasText: 'Summe / Stunde' });
    seed({ name, b: { metal: 10, solar: 5 } });
    await page.goto('/?view=resources');
    await expect(page.locator('.box .hd')).toHaveText(
      'Produktion pro Stunde (Produktionsfaktor 62 %)',
    );
    await expect(sum.locator('th').nth(1)).toHaveText('2.515');
    await expect(stock(page, 'Energie')).toHaveText('-99/161');
    await expect(stock(page, 'Energie')).toHaveClass(/bad/);
    seed({ name, b: { metal: 10, solar: 7 } });
    await page.reload();
    await expect(page.locator('.box .hd')).toHaveText(
      'Produktion pro Stunde (Produktionsfaktor 100 %)',
    );
    await expect(sum.locator('th').nth(1)).toHaveText('3.990');
    await expect(stock(page, 'Energie')).not.toHaveClass(/bad/);
    expect(w.problems).toEqual([]);
  });
});
