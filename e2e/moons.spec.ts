// Moons and the Mondzitadelle (#53, okf/features/moons.md): the admin's
// „Mond anlegen“, the moon on the Sternenkarte with its actions, the moon as
// an own place with its buildings and fields, flights to a moon and the moon
// chance of a battle report. A moon from a battle forms by chance only, so
// the tests make moons with the admin or with e2e/seed.ts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cli,
  expectShownPlace,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

/** The row of a player's planet on the Sternenkarte. */
const galaxyRow = (page: Page, player: string): Locator =>
  page.locator('tr').filter({
    has: page.locator('td', { hasText: new RegExp(`^${player} \\(Platz`) }),
  });

const moonRow = (page: Page): Locator => page.locator('tr.moon-row');
const lastToast = (page: Page): Locator => page.locator('.toast').last();

/** Opens the Sternenkarte at the home system of another player, from the highscore. */
async function openSystemOf(page: Page, player: string): Promise<void> {
  await nav(page, 'highscore');
  await page
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: player, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

/** axe (WCAG 2.1 A and AA) as in e2e/a11y.spec.ts: the violations of the page. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** Switches to the own moon in the planet list. */
async function chooseMoon(page: Page, name: string): Promise<void> {
  const selector = page.getByLabel('Aktiver Planet');
  const option = selector.locator('option', { hasText: `${name} (Mond) [` });
  await selector.selectOption((await option.getAttribute('value'))!);
  await expectShownPlace(page, `${name} (Mond)`);
}

test.describe('moons (#53)', () => {
  test('the admin puts a moon at a planet in the player record; every player sees it and opens its actions', async ({
    page,
  }) => {
    const w = watch(page);
    const pilot = uniqueName('MondPilot');
    const boss = uniqueName('MondAdmin');
    await register(page, pilot);
    await page.click('[data-act=logout]');
    await register(page, boss);
    cli('admin', boss);
    seed({ name: boss, ships: { lf: 3 }, res: { m: 0, c: 0, d: 10000 } });
    await page.reload();
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Spieler', exact: true }).click();
    await page
      .locator('[data-admin=stats]')
      .getByRole('button', { name: pilot, exact: true })
      .click();
    const home = page.getByRole('row', { name: /Heimatplanet/ });
    await expect(
      home.getByRole('button', { name: 'Mond anlegen' }),
    ).toBeVisible();
    // The player record with „Mond anlegen“ has no axe violations.
    expect(await violations(page)).toEqual([]);
    await home.getByLabel('Mondchance in %').fill('20');
    await home.getByRole('button', { name: 'Mond anlegen' }).click();
    await expect(home).toContainText('vorhanden');
    await expect(
      home.getByRole('button', { name: 'Mond anlegen' }),
    ).toHaveCount(0);
    expect(await violations(page)).toEqual([]);
    // The write is in the event log.
    await page.getByRole('tab', { name: 'Ereignisprotokoll' }).click();
    await page.getByLabel('Aktion', { exact: true }).fill('createMoon');
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    await expect(
      page.getByRole('row', { name: /admin.write \/ createMoon/ }),
    ).toContainText(pilot);

    // Every player sees the moon at the planet; its symbol opens its actions.
    await page.reload();
    await openSystemOf(page, pilot);
    const row = galaxyRow(page, pilot);
    const mark = row.getByRole('button', { name: 'Mond (Mond)' });
    await expect(mark).toHaveAttribute('aria-expanded', 'false');
    await expect(moonRow(page)).toHaveCount(0);
    // With the keyboard: Enter opens the row, the focus stays on the symbol.
    await mark.focus();
    await page.keyboard.press('Enter');
    await expect(mark).toHaveAttribute('aria-expanded', 'true');
    await expect(mark).toBeFocused();
    const moon = moonRow(page);
    await expect(moon).toContainText('Mond (Mond)');
    await expect(moon).toContainText(pilot);
    await expect(moon.getByText('Auspex-Erkundung')).toBeVisible();
    await expect(moon.getByText('Versorgungsflug')).toBeVisible();
    await moon.getByText('Sturmangriff').click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('attack');
    await expect(page.getByLabel('Zielart')).toHaveValue('moon');
    await expect(page.locator('#t_info')).toHaveText(`Mond (Mond) (${pilot})`);
    await page.getByLabel('Zielart').selectOption('planet');
    await expect(page.locator('#t_info')).toHaveText(`Heimatplanet (${pilot})`);
    // „Mond“ only where a moon is.
    // Players start on 4 to 12 and colonies of the tests lie on 15: 2 is free.
    const position = page.getByLabel('Position', { exact: true });
    const at = await position.inputValue();
    await position.fill('2');
    await page.getByLabel('Anzahl Abfangjäger').fill('1');
    await expect(
      page.getByLabel('Zielart').locator('option[value=moon]'),
    ).toBeDisabled();
    await position.fill(at);
    await page.getByLabel('Anzahl Abfangjäger').fill('2');
    await expect(
      page.getByLabel('Zielart').locator('option[value=moon]'),
    ).toBeEnabled();
    expect(w.problems).toEqual([]);
  });

  test('a moon is its own entry „<Name> (Mond)“ with 1 field, 3 more per Mondzitadelle, its buildings only and no base income', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Mondherr');
    await register(page, name);
    seed({
      name,
      moon: { res: { m: 1e6, c: 1e6, d: 1e6 } },
      res: { m: 1e6, c: 1e6, d: 1e6 },
    });
    await page.reload();
    // On the planet: no Mondzitadelle.
    await nav(page, 'buildings');
    await expect(
      page.locator('.item .nm', { hasText: 'Adamant-Tiefbohrung' }),
    ).toHaveCount(1);
    await expect(
      page.locator('.item .nm', { hasText: 'Mondzitadelle' }),
    ).toHaveCount(0);

    await chooseMoon(page, 'Mond');
    await nav(page, 'overview');
    await expect(page.locator('h2')).toContainText('Übersicht – Mond (Mond)');
    const facts = page.locator('.kv');
    await expect(facts.locator('tr', { hasText: 'Planetentyp' })).toContainText(
      'Mond',
    );
    await expect(facts.locator('tr', { hasText: 'Durchmesser' })).toContainText(
      '5.000 km (0/1 Felder)',
    );
    await expect(page.getByRole('img', { name: 'Mond (Mond)' })).toBeVisible();
    // Renamed like a planet, shown as „<Name> (Mond)“.
    await page.getByText('(umbenennen)').click();
    await expect(page.getByText('Mond umbenennen')).toBeVisible();
    await page.getByLabel('Neuer Name').fill('Luna');
    await page.getByRole('button', { name: 'OK' }).click();
    await expectShownPlace(page, 'Luna (Mond)');
    await expect(
      page
        .getByLabel('Aktiver Planet')
        .locator('option', { hasText: 'Luna (Mond) [' }),
    ).toHaveCount(1);

    await nav(page, 'buildings');
    await expect(page.locator('#fields')).toHaveText('Felder: 0 / 1');
    await expect(page.locator('.item .nm')).toHaveText([
      /^Servitorenschmiede/,
      /^Orbitale Schiffsschmiede/,
      /^Adamant-Gewölbe/,
      /^Psikristall-Reliquiar/,
      /^Promethium-Zisterne/,
      /^Mondzitadelle/,
      /^Auspex-Phalanx/,
      /^Warp-Tor/,
    ]);
    // By its name: the Auspex-Phalanx names the Mondzitadelle as its requirement.
    const citadel = page
      .locator('.item')
      .filter({ has: page.locator('.nm', { hasText: /^Mondzitadelle/ }) });
    await expect(citadel).toContainText('20.000');
    await expect(citadel).toContainText('40.000');
    await citadel.getByRole('button', { name: 'Bauen' }).click();
    await expect(citadel).toContainText('Ausbau auf Stufe 1');

    // A built Mondzitadelle: 1 + 3 fields, one of them its own.
    seed({ name, moon: { b: { moonbase: 1 }, bq: null } });
    await page.reload();
    await chooseMoon(page, 'Luna');
    await nav(page, 'buildings');
    await expect(page.locator('#fields')).toHaveText('Felder: 1 / 4');

    await nav(page, 'resources');
    await expect(page.locator('h2')).toHaveText('Rohstoffe auf Luna (Mond)');
    await expect(page.locator('tr', { hasText: 'Grundeinkommen' })).toHaveText(
      /^Grundeinkommen\s*0\s*0\s*0\s*0\s*$/,
    );
    expect(w.problems).toEqual([]);
  });

  test('a Verlegung flies from the planet to its own moon and lands there', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('MondFlug');
    await register(page, name);
    seed({ name, moon: {}, ships: { sc: 2 }, res: { m: 0, c: 0, d: 10000 } });
    await page.reload();
    await nav(page, 'galaxy');
    await page.getByText('zum Heimatsystem').click();
    await galaxyRow(page, name)
      .getByRole('button', { name: 'Mond (Mond)' })
      .click();
    const moon = moonRow(page);
    await expect(moon.getByRole('button', { name: 'Wechseln' })).toBeVisible();
    await moon.getByRole('button', { name: 'Verlegung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('deploy');
    await expect(page.getByLabel('Zielart')).toHaveValue('moon');
    await expect(page.locator('#t_info')).toHaveText(`Mond (Mond) (${name})`);
    await page.getByLabel('Anzahl Frachtläufer').fill('2');
    // The planet and its moon are 5 apart.
    await expect(page.locator('#i_dist')).toHaveText('5');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    seed({ name, landFleet: 'deploy' });
    await expect(page.locator('.fl-deploy')).toHaveCount(0, { timeout: 15000 });
    await chooseMoon(page, 'Mond');
    await nav(page, 'fleet');
    await expect(
      page
        .locator('tr')
        .filter({ has: page.locator('input.fs'), hasText: 'Frachtläufer' }),
    ).toContainText('2');
    expect(w.problems).toEqual([]);
  });

  test('a battle at a planet with a big Trümmerfeld reports the moon chance', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('MondSturm');
    const b = uniqueName('MondZiel');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    seed({ name: a, ships: { lf: 5, sc: 2 }, res: { m: 0, c: 0, d: 10000 } });
    // Points against the noob protection; 100,000 Adamant in the field: 1 %.
    seed({
      name: b,
      b: { metal: 12, crystal: 10 },
      ships: { probe: 1 },
      res: { m: 50000, c: 50000, d: 50000 },
      debris: { m: 100000, c: 0 },
    });
    await openSystemOf(page, b);
    await galaxyRow(page, b).getByText('Sturmangriff').click();
    await page.getByLabel('Anzahl Abfangjäger').fill('5');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    seed({ name: a, landFleet: 'attack' });
    const badge = page.locator('#menu [data-v=messages] .badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await nav(page, 'messages');
    const battle = page
      .locator('.rep')
      .filter({ has: page.locator('.t', { hasText: /^Kampfbericht/ }) });
    await battle.locator('.t').click();
    await expect(battle).toContainText(
      'Es entstand ein Trümmerfeld mit 0 Adamant und 300 Psikristall.',
    );
    await expect(battle).toContainText('Mondchance: 1 %');
    expect(w.problems).toEqual([]);
  });

  test('the moon on the Sternenkarte opens its actions on a phone @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('MondHandy');
    const b = uniqueName('MondNachbar');
    await register(page, b);
    seed({ name: b, moon: { name: 'Selene' } });
    await page.click('[data-act=logout]');
    await register(page, a);
    await openSystemOf(page, b);
    const mark = galaxyRow(page, b).getByRole('button', {
      name: 'Selene (Mond)',
    });
    await mark.tap();
    await expect(moonRow(page)).toContainText('Selene (Mond)');
    await expect(moonRow(page).getByText('Sturmangriff')).toBeVisible();
    // Against the device width: a too wide table also widens innerWidth.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    await mark.tap();
    await expect(moonRow(page)).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });
});
