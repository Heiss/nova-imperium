// The game flows of #68 that had no browser test, and the admin event log of
// a battle (#151). Flights and the shipyard
// are moved forward with e2e/seed.ts; the mails go through the mail sink of
// the second server (e2e/env.ts, e2e/mail.ts).
import { expect, test } from '@playwright/test';
import {
  choosePlanet,
  cli,
  emailOf,
  expectShownPlace,
  galaxyRow,
  lastToast,
  login,
  loginByCode,
  mail,
  mailCli,
  nav,
  register,
  registerByMail,
  seed,
  shownPlace,
  stock,
  uniqueName,
  watch,
} from './helpers.ts';
import {
  attack,
  openSystemOf,
  report,
  sendTransport,
  shipCount,
} from './fleet-helpers.ts';
import { E2E_MAIL_URL } from './env.ts';

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

  test('the overview shows the cargo of a transport on a 390 px phone (#259) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('LadungH');
    await register(page, name);
    seed({
      name,
      ships: { sc: 1 },
      res: { m: 5000, c: 0, d: 5000 },
      colony: { res: { m: 0, c: 0, d: 0 } },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await sendTransport(page);
    await nav(page, 'overview');
    const row = page.locator('.fl-transport');
    await expect(row).toContainText('Deine Flotte (1 Frachtläufer) von ');
    await expect(row).toContainText(
      'Versorgungsflug · Ladung: Adamant 1.000 · Psikristall 0 · Promethium 0',
    );
    await expect(row).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
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
    // Unloaded, it carries nothing home and shows no cargo (#259).
    await expect(page.locator('.fl-back')).not.toContainText('Ladung');
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
    await expect(page.locator('.fl-back')).toContainText(
      'zurück · Ladung: Adamant 1.000 · Psikristall 0 · Promethium 0',
    );
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
    // Holds of 2 × 5,000 + 3 × 50, filled evenly (#240): no Promethium, so
    // Adamant and Psikristall take half each.
    await page.getByText('alles (gleichmäßig)', { exact: true }).click();
    await expect(page.getByLabel('Adamant', { exact: true })).toHaveValue(
      '5075',
    );
    await expect(page.getByLabel('Psikristall', { exact: true })).toHaveValue(
      '5075',
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
    await expect(shownPlace(page)).toHaveText(/\[\d+:\d+:\d+\]$/);
    const [, g, s] = /\[(\d+):(\d+):\d+\]/.exec(
      (await shownPlace(page).textContent())!,
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
    await expectShownPlace(page, 'Kolonie');
    await expect(colony).toContainText('Aktiver Planet');
    await expect(
      page
        .locator('tr.me', { hasText: 'Heimatplanet' })
        .getByRole('button', { name: 'Wechseln' }),
    ).toBeVisible();
    expect(w.problems).toEqual([]);
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

  test('an invitation link shows no login while the server checks it (#272)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Einladung');
    mailCli('invite', emailOf(name));
    const [link] = await mail(emailOf(name), /^http:\S+#invite=[\w-]+$/m);
    // The check of the invitation waits until the test has looked: the
    // login rendered after the 401 of /api/state took the name and the
    // password, and the registration replaced it empty (#272).
    let pending!: () => void;
    const checking = new Promise<void>((resolve) => (pending = resolve));
    let answer!: () => void;
    const looked = new Promise<void>((resolve) => (answer = resolve));
    await page.route('**/api/invite/check', async (route) => {
      pending();
      await looked;
      await route.continue();
    });
    await page.goto(link);
    await checking;
    await expect(page.locator('#authform')).toHaveCount(0);
    await expect(page.locator('#view')).toHaveText('Lade Universum …');
    answer();
    await expect(page.locator('.auth .hd')).toHaveText(
      'Neues Imperium gründen',
    );
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(lastToast(page)).toContainText(
      'Konto erstellt. Melde dich jetzt an.',
    );
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
