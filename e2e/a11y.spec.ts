import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cli,
  expectShownPlace,
  galaxyRow,
  nav,
  register,
  seed,
  uniqueName,
  withWebPush,
} from './helpers.ts';

// Automated accessibility check (axe, WCAG 2.1 A and AA), as in muffelblog. It
// finds a part of the problems only: it does not replace a look with a screen
// reader and the keyboard.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const lastToast = (page: Page): Locator => page.locator('.toast').last();

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} [${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}]`,
  );
}

const VIEWS = [
  'overview',
  'buildings',
  'resources',
  'research',
  'shipyard',
  'defense',
  'fleet',
  'galaxy',
  'messages',
  'highscore',
  'news',
  'lexicanum',
  'help',
  'admin',
];

test.describe('accessibility (axe)', () => {
  test('the check itself finds problems (so a pass means something)', async ({
    page,
  }) => {
    await page.setContent(
      '<!doctype html><html><body><img src="x.png"><button></button></body></html>',
    );
    const found = (await violations(page)).join('\n');
    expect(found).toContain('image-alt');
    expect(found).toContain('button-name');
    expect(found).toContain('document-title');
    expect(found).toContain('html-has-lang');
  });

  test('the login page has no violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#a_name')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('every view of the game has no violations', async ({ page }) => {
    const name = uniqueName('Axe');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    const found: string[] = [];
    for (const view of VIEWS) {
      await nav(page, view);
      await expect(page.locator('#menu a.on')).toHaveAttribute('data-v', view);
      found.push(...(await violations(page)).map((v) => `${view}: ${v}`));
    }
    expect(found).toEqual([]);
  });

  test('the resources page and the highscore have no violations on a phone (#189) @phone', async ({
    page,
  }) => {
    const name = uniqueName('AxeRohH');
    await register(page, name);
    // Every kind of producer and a throttled one with its note.
    seed({
      name,
      b: { metal: 30, crystal: 28, deut: 5, solar: 30, fusion: 8 },
      ships: { sat: 1200 },
      research: { energy: 3 },
      temp: 20,
      res: { m: 0, c: 0, d: 0 },
    });
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/?view=resources');
    await expect(page.locator('#view')).toContainText('gedrosselt auf 58 %');
    const found = (await violations(page)).map((v) => `resources: ${v}`);
    // The coordinates below the name instead of the column „Heimatplanet“.
    await page.goto('/?view=highscore');
    await expect(
      page.locator('tr.me [data-act=gto]').filter({ visible: true }),
    ).toHaveCount(1);
    found.push(...(await violations(page)).map((v) => `highscore: ${v}`));
    expect(found).toEqual([]);
  });

  test('a Trümmerfeld on the Sternenkarte and the fleet form of a Bergung have no violations (#45)', async ({
    page,
  }) => {
    const name = uniqueName('AxeBerg');
    await register(page, name);
    seed({ name, ships: { recycler: 1 }, debris: { m: 1800, c: 600 } });
    await page.reload();
    const found: string[] = [];
    await nav(page, 'galaxy');
    await page.getByText('zum Heimatsystem').click();
    // Only this player's row: another test may leave a field in the system.
    const row = galaxyRow(page, name);
    const mark = row.getByRole('img', {
      name: 'Trümmerfeld: 1.800 Adamant, 600 Psikristall',
    });
    await expect(mark).toBeVisible();
    found.push(...(await violations(page)).map((v) => `galaxy: ${v}`));
    await row.getByRole('button', { name: 'Bergung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('harvest');
    found.push(...(await violations(page)).map((v) => `fleet: ${v}`));
    expect(found).toEqual([]);
  });

  // „Mond anlegen“ in the player record is checked in e2e/moons.spec.ts,
  // after the admin test of game.spec.ts counts the reads of a player record.
  test('a moon on the Sternenkarte, its overview, buildings and fleet form have no violations (#53)', async ({
    page,
  }) => {
    const name = uniqueName('AxeMond');
    // A unique moon name: two runs of this test can share a home system (#252).
    const moon = uniqueName('Axe');
    await register(page, name);
    seed({ name, moon: { name: moon }, ships: { sc: 1 } });
    await page.reload();
    const found: string[] = [];
    const check = async (label: string): Promise<void> => {
      found.push(...(await violations(page)).map((v) => `${label}: ${v}`));
    };
    await nav(page, 'galaxy');
    await page.getByText('zum Heimatsystem').click();
    await page.getByRole('button', { name: `${moon} (Mond)` }).click();
    await expect(page.locator('tr.moon-row')).toBeVisible();
    await check('galaxy');
    await page
      .locator('tr.moon-row')
      .getByRole('button', { name: 'Verlegung' })
      .click();
    await expect(page.getByLabel('Zielart')).toHaveValue('moon');
    await check('fleet');
    const selector = page.getByLabel('Aktiver Planet');
    await selector.selectOption(
      (await selector
        .locator('option', { hasText: `${moon} (Mond) [` })
        .getAttribute('value'))!,
    );
    await expectShownPlace(page, `${moon} (Mond)`);
    for (const view of ['overview', 'buildings', 'resources'] as const) {
      await nav(page, view);
      await check(view);
    }
    expect(found).toEqual([]);
  });

  test('the fields, a full planet and the Weltenschmiede have no violations (#51)', async ({
    page,
  }) => {
    const name = uniqueName('AxeFeld');
    await register(page, name);
    const found: string[] = [];
    const check = async (label: string): Promise<void> => {
      found.push(...(await violations(page)).map((v) => `${label}: ${v}`));
    };
    // Full, with the Weltenschmiede short of energy in its row.
    seed({
      name,
      b: { robot: 10, nanite: 1, solar: 13, metal: 40, crystal: 40, deut: 59 },
      research: { energy: 12 },
    });
    await page.reload();
    await expect(page.locator('.kv')).toContainText('163/163 Felder');
    await check('overview full');
    await nav(page, 'buildings');
    await expect(page.locator('#fields')).toHaveText('Felder: 163 / 163');
    await check('buildings full');
    // Free fields: the Weltenschmiede waits for energy.
    seed({ name, b: { robot: 10, nanite: 1, solar: 13 } });
    await page.reload();
    await expect(page.locator('#view')).toContainText('Zu wenig Energie');
    await check('buildings energy');
    seed({ name, unlimited: true });
    await page.reload();
    await expect(page.locator('#fields')).toHaveText('Felder: 24 / unbegrenzt');
    await check('buildings unlimited');
    expect(found).toEqual([]);
  });

  test('the „?“ and the side panel of the Lexicanum have no violations, closed and opened (#63, #285)', async ({
    page,
  }) => {
    const name = uniqueName('AxeEx');
    await register(page, name);
    seed({ name, b: { lab: 1, yard: 2 } });
    await page.reload();
    const found: string[] = [];
    const check = async (label: string): Promise<void> => {
      found.push(...(await violations(page)).map((v) => `${label}: ${v}`));
    };
    for (const [view, entry] of [
      ['buildings', 'Adamant-Tiefbohrung'],
      ['research', 'Machina-Energetik'],
      ['shipyard', 'Spähschädel'],
    ] as const) {
      await nav(page, view);
      await check(`${view} closed`);
      await page.getByRole('button', { name: `Erklärung zu ${entry}` }).click();
      await expect(page.locator('#lexicanum-panel')).toBeVisible();
      await check(`${view} opened`);
      await page.keyboard.press('Escape');
    }
    await nav(page, 'help');
    await page.getByLabel('(?)-Symbol').selectOption({ label: 'Ausblenden' });
    await page.click('[data-act=saveopt]');
    await expect(lastToast(page)).toContainText('Gespeichert.');
    await check('help');
    await nav(page, 'buildings');
    await expect(page.locator('#view .exq')).toHaveCount(0);
    await check('buildings hidden');
    expect(found).toEqual([]);
  });

  test('the tab „Universum“ and the dialog „Endzeit einläuten“ have no violations (#161)', async ({
    page,
  }) => {
    const name = uniqueName('AxeEnd');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    const found: string[] = [];
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await expect(
      page.getByRole('button', { name: 'Endzeit einläuten' }),
    ).toBeVisible();
    found.push(...(await violations(page)).map((v) => `universe: ${v}`));
    await page.getByRole('button', { name: 'Endzeit einläuten' }).click();
    await expect(page.getByLabel('Flugzeit der Gabe (Minuten)')).toBeVisible();
    found.push(...(await violations(page)).map((v) => `dialog: ${v}`));
    // Only looked at: the gift would go to every player of this server.
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    cli('unadmin', name);
    expect(found).toEqual([]);
  });

  test('the dialog „Neue Runde“ with the box „Gilden (mit Chat)“ has no violations (#191)', async ({
    page,
  }) => {
    const name = uniqueName('AxeRunde');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page.getByRole('button', { name: 'Neue Runde starten' }).click();
    await expect(page.getByLabel('Gilden (mit Chat)')).toBeChecked();
    await expect(
      page.getByText(
        'Eine neue Runde leert alle Gilden-Chats. Ohne Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat gelöscht.',
      ),
    ).toBeVisible();
    // The thresholds of the activity markers in their group (#229).
    const activity = page.getByRole('group', { name: 'Aktivität' });
    await expect(activity.getByRole('spinbutton')).toHaveCount(4);
    await expect(
      activity.getByLabel('Inaktiv ab (Tage)', { exact: true }),
    ).toHaveValue('7');
    const found = (await violations(page)).map((v) => `dialog: ${v}`);
    // Only looked at: a new round would reset every planet of this server.
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    cli('unadmin', name);
    expect(found).toEqual([]);
  });

  test('the options with the push kinds have no violations, on and off (#192)', async ({
    page,
  }) => {
    // The push kinds show only on a server with Web Push (#192).
    await withWebPush(page);
    await register(page, uniqueName('AxePush'));
    await nav(page, 'help');
    const found: string[] = [];
    const box = page.getByRole('checkbox', { name: 'Servernachrichten' });
    await expect(box).toBeChecked();
    found.push(...(await violations(page)).map((v) => `on: ${v}`));
    await box.uncheck();
    await expect(lastToast(page)).toContainText('Gespeichert.');
    await expect(box).not.toBeChecked();
    found.push(...(await violations(page)).map((v) => `off: ${v}`));
    expect(found).toEqual([]);
  });

  test('the tab „Fehler“ and the dialog „Problem melden“ have no violations (#126)', async ({
    page,
  }) => {
    const name = uniqueName('AxeErr');
    // A unique error text: a repeat run found two rows with a fixed one (#267).
    // The colon keeps the log's scrubber from taking the text for a token
    // (20 word characters with a digit) or the 6 characters for a login code.
    const error = `Axe-Testfehler:${uniqueName('')}`;
    await register(page, name);
    cli('admin', name);
    seed({ name, serverError: error });
    await page.reload();
    const found: string[] = [];
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Fehler' }).click();
    const row = page.getByRole('row', { name: error });
    await row.getByText(/^Eintrag \d+$/).click();
    await expect(row.locator('pre')).toBeVisible();
    found.push(...(await violations(page)).map((v) => `errors: ${v}`));
    await nav(page, 'buildings');
    await page.route(
      '**/api/action',
      (route) =>
        route.fulfill({ status: 500, json: { error: 'Serverfehler.' } }),
      { times: 1 },
    );
    await page.click('[data-act=build][data-k=metal]');
    const offer = page.getByRole('button', { name: 'Problem melden' });
    await expect(offer).toBeVisible();
    found.push(...(await violations(page)).map((v) => `toast: ${v}`));
    await offer.click();
    await expect(page.locator('#reportform-dialog')).toBeVisible();
    found.push(...(await violations(page)).map((v) => `dialog: ${v}`));
    expect(found).toEqual([]);
  });

  test('the guild view with its ranks has no violations (#163)', async ({
    page,
    browser,
  }) => {
    const lead = uniqueName('AxeGilde');
    const tag = `A${Date.now() % 1000000}`;
    const title = `[${tag}] Axe ${tag}`;
    await register(page, lead);
    const found: string[] = [];
    const check = async (p: Page, label: string): Promise<void> => {
      found.push(...(await violations(p)).map((v) => `${label}: ${v}`));
    };
    await nav(page, 'guilds');
    await check(page, 'directory');
    await page.getByLabel('Kürzel').fill(tag);
    await page.getByLabel('Name', { exact: true }).fill(`Axe ${tag}`);
    await page.getByRole('button', { name: 'Gilde gründen' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByLabel('Name des neuen Rangs').fill('Offizier');
    await page.getByRole('button', { name: 'Rang anlegen' }).click();
    await expect(page.locator('fieldset.rank')).toHaveCount(3);
    // The public page, for an applicant.
    // axe needs a page of its own context.
    const context = await browser.newContext();
    const other = await context.newPage();
    await register(other, uniqueName('AxeGast'));
    await nav(other, 'guilds');
    await other.getByRole('link', { name: title }).click();
    await check(other, 'public');
    await other.getByRole('button', { name: 'Bewerben' }).click();
    await expect(other.getByText('Deine Bewerbung ist offen.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Annehmen' })).toBeVisible();
    await check(page, 'Leitung with ranks and an application');
    await page.getByRole('button', { name: 'Annehmen' }).click();
    await expect(page.locator('select[id^=rank_of_]')).toHaveCount(1);
    await check(page, 'Leitung with a member');
    await other.reload();
    await expect(other.locator('fieldset.rank')).toHaveCount(3);
    await check(other, 'member');
    // The dialogs of the hand-over and of dissolving (owner, 2026-11-14).
    await page
      .getByRole('button', { name: 'Leitung übergeben' })
      .first()
      .click();
    await expect(page.getByLabel('Dein neuer Rang')).toBeVisible();
    await check(page, 'hand-over dialog');
    await page.getByRole('button', { name: 'Abbrechen' }).click();
    await page.getByRole('button', { name: 'Gilde auflösen' }).click();
    await expect(page.locator('#dissolve_tag')).toBeVisible();
    await check(page, 'dissolve dialog');
    await context.close();
    expect(found).toEqual([]);
  });

  test('the guild chat and the chat dialog of the admin have no violations (#169)', async ({
    page,
    browser,
  }) => {
    const lead = uniqueName('AxeChat');
    const tag = `K${Date.now() % 1000000}`;
    const title = `[${tag}] Axe ${tag}`;
    await register(page, lead);
    cli('admin', lead);
    const found: string[] = [];
    const check = async (p: Page, label: string): Promise<void> => {
      found.push(...(await violations(p)).map((v) => `${label}: ${v}`));
    };
    await nav(page, 'guilds');
    await page.getByLabel('Kürzel').fill(tag);
    await page.getByLabel('Name', { exact: true }).fill(`Axe ${tag}`);
    await page.getByRole('button', { name: 'Gilde gründen' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await check(page, 'empty chat');
    const context = await browser.newContext();
    const other = await context.newPage();
    const name = uniqueName('AxeBote');
    await register(other, name);
    await nav(other, 'guilds');
    await other.getByRole('link', { name: title }).click();
    await other.getByRole('button', { name: 'Bewerben' }).click();
    await expect(other.getByText('Deine Bewerbung ist offen.')).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'Annehmen' }).click();
    // An event of the server and the notice of the box (#169, 2026-11-15).
    await expect(page.getByRole('log', { name: 'Chat' })).toContainText(
      `${name} ist der Gilde beigetreten.`,
    );
    await expect(
      page.getByText('Die Spielleitung kann diesen Chat lesen.'),
    ).toBeVisible();
    await check(page, 'an event');
    // The red mark on „Gilden“ while the Leitung is elsewhere.
    const guildPage = page.url();
    await nav(page, 'overview');
    await other.reload();
    await other.getByLabel('Nachricht', { exact: true }).fill('<b>Hallo</b>');
    await other.getByRole('button', { name: 'Senden' }).click();
    await expect(other.getByRole('log', { name: 'Chat' })).toContainText(
      '<b>Hallo</b>',
    );
    await check(other, 'member with a message');
    await expect(
      page.locator(
        '[data-v=guilds] .badge[aria-label="Neue Nachrichten im Gilden-Chat"]',
      ),
    ).not.toHaveCount(0, { timeout: 10000 });
    await check(page, 'the red mark on „Gilden“');
    await page.goto(guildPage);
    await expect(
      page.getByRole('log', { name: 'Chat' }).getByRole('button', {
        name: 'Löschen',
      }),
    ).toHaveCount(1);
    await check(page, 'Leitung with „Löschen“');
    other.once('dialog', (d) => void d.accept());
    await other.getByRole('button', { name: 'Gilde verlassen' }).click();
    // The leave is in before the Leitung's page loads again (CodeRabbit on
    // #216).
    await expect(lastToast(other)).toContainText('Gilde verlassen.');
    await page.reload();
    await expect(page.getByRole('log', { name: 'Chat' })).toContainText(
      'ehemaliges Mitglied',
    );
    await check(page, 'a former member');
    await page.getByRole('button', { name: 'Chat lesen' }).click();
    await expect(
      page.locator('#modal').getByRole('heading', { name: `Chat ${title}` }),
    ).toBeVisible();
    await check(page, 'admin chat dialog');
    cli('unadmin', lead);
    await context.close();
    expect(found).toEqual([]);
  });
});
