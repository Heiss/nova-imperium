// The recognition of incoming fleets (#228, okf/features/espionage-defense.md):
// the defender sees of a foreign fleet only what the own Auspex-Lehre
// recognizes, classic 2 / 4 / 8 (D1), and the server sends nothing more.
// The admin sets the thresholds in „Neue Runde“ and changes them in the
// universe settings during the round (X1); that part runs on the mail server
// (#68), its own universe, after the other new rounds there
// (flows.spec.ts, guild-switch.spec.ts), and leaves 2 / 4 / 8 behind.
// Desktop and phone.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';
import {
  galaxyRow,
  login,
  loginByCode,
  logout,
  mailCli,
  mailSeed,
  nav,
  register,
  registerByMail,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';
import { E2E_MAIL_URL } from './env.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const LABEL = {
  total: 'Fremde Flotten: Schiffe insgesamt ab Auspex-Lehre',
  types: 'Fremde Flotten: Schiffstypen ab Auspex-Lehre',
  counts: 'Fremde Flotten: Anzahl je Schiffstyp ab Auspex-Lehre',
} as const;

async function violations(page: Page, label: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${label}: ${v.id}: ${v.help}`);
}

const lastToast = (page: Page): Locator => page.locator('.toast').last();
/** The row of the incoming attack in the overview. */
const incoming = (page: Page): Locator =>
  page.locator('.fl-attack', { hasText: 'Eine fremde Flotte von' });

/** The foreign fleets as the server sends them. */
const fleetsSent = (page: Page): Promise<Record<string, unknown>[]> =>
  page.evaluate(async () => {
    const r = await fetch('/api/state');
    const s = (await r.json()) as {
      me: { id: string };
      fleets: { owner: string }[];
    };
    return s.fleets.filter((f) => f.owner !== s.me.id);
  });

/**
 * The attacker (logged in) sends 5 Abfangjäger and 2 Frachtläufer against
 * the defender's home planet through the Sternenkarte; the fleet stays on
 * its way.
 */
async function sendAttack(page: Page, a: string, b: string): Promise<void> {
  seed({ name: a, ships: { lf: 5, sc: 2 }, res: { m: 0, c: 0, d: 10000 } });
  // Mines give the defender a fifth of the attacker's points (no noob
  // protection).
  seed({ name: b, b: { metal: 12, crystal: 10 } });
  await nav(page, 'highscore');
  await page
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: b, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await galaxyRow(page, b).getByText('Sturmangriff').click();
  await page.getByLabel('Anzahl Abfangjäger').fill('5');
  await page.getByLabel('Anzahl Frachtläufer').fill('2');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
}

async function defenderFlow(page: Page): Promise<void> {
  const w = watch(page);
  const a = uniqueName('Kundschaft');
  const b = uniqueName('Wache');
  await register(page, b);
  await logout(page);
  await register(page, a);
  await sendAttack(page, a, b);
  // The attacker sees the own fleet in full.
  await expect(page.locator('.fl-attack')).toContainText(
    'Deine Flotte (5 Abfangjäger, 2 Frachtläufer)',
  );
  await logout(page);
  await login(page, b);
  const row = incoming(page);
  await expect(row).toContainText(`Eine fremde Flotte von ${a}`);
  await expect(row).toContainText('Sturmangriff (Zusammensetzung unbekannt)');
  // Hidden parts are not even sent.
  const [hidden] = await fleetsSent(page);
  expect(Object.keys(hidden!).sort()).toEqual(
    ['arr', 'fromC', 'id', 'mission', 'owner', 'state', 'to', 'toC'].sort(),
  );

  const at = async (spy: number, shown: string): Promise<void> => {
    seed({ name: b, research: { spy } });
    await page.reload();
    await expect(incoming(page)).toContainText(`Sturmangriff (${shown})`);
  };
  await at(1, 'Zusammensetzung unbekannt');
  await at(2, 'Schiffe insgesamt: 7');
  await at(3, 'Schiffe insgesamt: 7');
  await at(4, 'Schiffe insgesamt: 7 · Abfangjäger, Frachtläufer');
  const [types] = await fleetsSent(page);
  expect(types).toMatchObject({ total: 7, types: ['lf', 'sc'] });
  expect(types).not.toHaveProperty('ships');
  expect(await violations(page, 'overview with a foreign fleet')).toEqual([]);
  await at(7, 'Schiffe insgesamt: 7 · Abfangjäger, Frachtläufer');
  await at(8, '5 Abfangjäger, 2 Frachtläufer');
  await expect(incoming(page)).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(w.problems).toEqual([]);
}

/** Opens the dialog „Neue Runde“ of the tab „Universum“. */
async function openRoundDialog(page: Page): Promise<void> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page.getByRole('button', { name: 'Neue Runde starten' }).click();
  await expect(
    page.getByText('Wirklich eine neue Runde starten?'),
  ).toBeVisible();
}

/** The dialog „Neue Runde“; both it and the settings name the thresholds alike. */
const dialog = (page: Page): Locator => page.locator('#modalIn');
const settings = (page: Page): Locator =>
  page.getByRole('tabpanel', { name: 'Universum' });

/** The thresholds as the dialog or the universe settings show them. */
async function shownLevels(scope: Locator): Promise<string[]> {
  return [
    await scope.getByLabel(LABEL.total, { exact: true }).inputValue(),
    await scope.getByLabel(LABEL.types, { exact: true }).inputValue(),
    await scope.getByLabel(LABEL.counts, { exact: true }).inputValue(),
  ];
}

async function fillLevels(scope: Locator, levels: number[]): Promise<void> {
  const labels = [LABEL.total, LABEL.types, LABEL.counts];
  for (const [i, label] of labels.entries())
    await scope.getByLabel(label, { exact: true }).fill(String(levels[i]));
}

/** Saves the universe settings with the given thresholds. */
async function saveLevels(page: Page, levels: number[]): Promise<void> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await fillLevels(settings(page), levels);
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(lastToast(page)).toContainText('Einstellungen gespeichert.');
}

async function adminFlow(page: Page): Promise<void> {
  const problems = [watch(page)];
  const found: string[] = [];
  const admin = uniqueName('Spaeher');
  const enemy = uniqueName('Feindflug');
  await registerByMail(page, admin);
  mailCli('admin', admin);
  await loginByCode(page, admin);

  // The dialog offers the thresholds of the round: 2 / 4 / 8.
  await openRoundDialog(page);
  expect(await shownLevels(dialog(page))).toEqual(['2', '4', '8']);
  // The three stand in one framed group with the legend of the owner
  // (2026-11-18); the labels of the fields stay as they are.
  const group = dialog(page).getByRole('group', {
    name: 'Fremde Flotten erkennen',
    exact: true,
  });
  await expect(group).toBeVisible();
  for (const label of Object.values(LABEL))
    await expect(group.getByLabel(label, { exact: true })).toHaveCount(1);
  await expect(group.getByRole('spinbutton')).toHaveCount(3);
  found.push(...(await violations(page, 'dialog „Neue Runde“')));
  // A level outside 0 to 100 is refused by the server, the round stays.
  await dialog(page).getByLabel(LABEL.counts, { exact: true }).fill('101');
  await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
  await expect(lastToast(page)).toContainText(
    `${LABEL.counts}: ganze Zahl von 0 bis 100.`,
  );
  // An emptied field is no level, not 0: refused as well.
  await openRoundDialog(page);
  await dialog(page).getByLabel(LABEL.total, { exact: true }).fill('');
  await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
  await expect(lastToast(page)).toContainText(
    `${LABEL.total}: ganze Zahl von 0 bis 100.`,
  );
  await openRoundDialog(page);
  await fillLevels(dialog(page), [0, 1, 5]);
  await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
  await expect(lastToast(page)).toContainText(
    'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.',
  );

  // An attack of another player on the new planet of the admin, who has
  // Auspex-Lehre 1: the total and the types, not the numbers.
  mailSeed({
    name: admin,
    b: { metal: 12, crystal: 10 },
    research: { spy: 1 },
  });
  const home = await page.evaluate(async () => {
    const r = await fetch('/api/state');
    return ((await r.json()) as { planet: { g: number; s: number; p: number } })
      .planet;
  });
  const enemyContext = await page.context().browser()!.newContext();
  const pe = await enemyContext.newPage();
  problems.push(watch(pe));
  await registerByMail(pe, enemy);
  await loginByCode(pe, enemy);
  mailSeed({
    name: enemy,
    ships: { lf: 5, sc: 2 },
    res: { m: 0, c: 0, d: 10000 },
  });
  const sent = await pe.evaluate(async (to) => {
    const s = (await (await fetch('/api/state')).json()) as {
      planet: { id: string };
    };
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'send',
        planet: s.planet.id,
        ships: { lf: 5, sc: 2 },
        to,
        mission: 'attack',
        cargo: { m: 0, c: 0, d: 0 },
        pct: 10,
      }),
    });
    return ((await r.json()) as { error?: string }).error ?? null;
  }, home);
  expect(sent).toBeNull();
  await enemyContext.close();
  await page.goto(E2E_MAIL_URL);
  await expect(incoming(page)).toContainText(
    'Sturmangriff (Schiffe insgesamt: 7 · Abfangjäger, Frachtläufer)',
  );

  // Changed in the universe settings during the round: at once.
  await saveLevels(page, [0, 1, 1]);
  await nav(page, 'overview');
  await expect(incoming(page)).toContainText(
    'Sturmangriff (5 Abfangjäger, 2 Frachtläufer)',
  );
  found.push(...(await violations(page, 'overview')));

  // Back to 2 / 4 / 8: nothing for Auspex-Lehre 1, and the next dialog
  // offers the same values.
  await saveLevels(page, [2, 4, 8]);
  expect(await shownLevels(settings(page))).toEqual(['2', '4', '8']);
  found.push(...(await violations(page, 'universe settings')));
  await nav(page, 'overview');
  await expect(incoming(page)).toContainText(
    'Sturmangriff (Zusammensetzung unbekannt)',
  );
  await openRoundDialog(page);
  expect(await shownLevels(dialog(page))).toEqual(['2', '4', '8']);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  mailCli('unadmin', admin);
  expect(found).toEqual([]);
  expect(problems.flatMap((w) => w.problems)).toEqual([]);
}

test.describe('incoming fleets by the Auspex-Lehre (#228)', () => {
  test('the defender sees only what the Auspex-Lehre recognizes', async ({
    page,
  }) => {
    await defenderFlow(page);
  });

  test('the defender sees only what the Auspex-Lehre recognizes, on a phone @phone', async ({
    page,
  }) => {
    await defenderFlow(page);
  });

  test('the admin sets the thresholds in „Neue Runde“ and changes them during the round', async ({
    page,
  }) => {
    // Two sessions, a round reset and four axe scans: longer than 30 s.
    test.setTimeout(90000);
    await adminFlow(page);
  });

  test('the admin sets the thresholds in „Neue Runde“ and changes them during the round, on a phone @phone', async ({
    page,
  }) => {
    // Two sessions, a round reset and four axe scans: longer than 30 s.
    test.setTimeout(90000);
    await adminFlow(page);
  });
});
