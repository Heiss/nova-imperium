// The Mondbruch (#95, okf/features/moons.md; owner, 2026-11-13 and
// 2026-11-16): a fleet with Weltenbrecher flies to a foreign moon, fights
// and rolls; the attacker reads the rolls in the battle report, the owner
// that his moon is gone, and the moon leaves his planet list. Seven
// Weltenbrecher break a moon of 3,600 km for certain (min(100, 40 · √7));
// whether they are torn apart (30 %) is left to chance. The flight lands
// with e2e/seed.ts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  galaxyRow,
  login,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const lastToast = (page: Page): Locator => page.locator('.toast').last();
const report = (page: Page, title: string | RegExp): Locator =>
  page.locator('.rep').filter({ has: page.locator('.t', { hasText: title }) });

/** An action as from another device: the refusal of the server. */
const refusal = (page: Page, data: object): Promise<string | undefined> =>
  page.evaluate(async (body) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return ((await r.json()) as { error?: string }).error;
  }, data);

/** axe (WCAG 2.1 A and AA) as in e2e/a11y.spec.ts: the violations of the page. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

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

/**
 * The owner gets a moon of 3,600 km and the points of research, so the
 * noob protection does not shield him from the Weltenbrecher; the attacker
 * opens the fleet form at the moon from the Sternenkarte.
 */
async function toTheMoon(page: Page, a: string, b: string): Promise<void> {
  await register(page, b);
  await page.click('[data-act=logout]');
  await register(page, a);
  seed({
    name: b,
    research: { energy: 14 },
    moon: { diameter: 3600, res: { m: 1000, c: 1000, d: 1000 } },
  });
  seed({
    name: a,
    ships: { dstar: 7, sc: 1 },
    res: { m: 0, c: 0, d: 100000 },
  });
  await page.reload();
  await openSystemOf(page, b);
  const row = galaxyRow(page, b);
  await row.getByRole('button', { name: 'Mond (Mond)' }).click();
  await page.locator('tr.moon-row').getByText('Sturmangriff').click();
  await expect(page.getByLabel('Zielart')).toHaveValue('moon');
}

/** Sends the Mondbruch from the fleet form and lets it arrive now. */
async function sendMondbruch(page: Page, a: string): Promise<void> {
  await page.getByLabel('Anzahl Weltenbrecher').fill('7');
  await page.getByLabel('Anzahl Frachtläufer').fill('1');
  await page.getByLabel('Auftrag').selectOption({ label: 'Mondbruch' });
  await expect(page.getByLabel('Auftrag')).toHaveValue('moonbreak');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
  await expect(page.locator('.fl-moonbreak')).toContainText('Mondbruch');
  seed({ name: a, landFleet: 'moonbreak' });
}

async function mondbruch(page: Page, base: string): Promise<void> {
  const w = watch(page);
  const a = uniqueName(`${base}Brecher`);
  const b = uniqueName(`${base}Mondherr`);
  await toTheMoon(page, a, b);
  // A Mondbruch needs a Weltenbrecher; the other ships alone are refused.
  await page.getByLabel('Anzahl Frachtläufer').fill('1');
  await page.getByLabel('Auftrag').selectOption('moonbreak');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText(
    'Du brauchst einen Weltenbrecher.',
  );
  // And only against a moon: the form offers no Mondbruch at a planet (#253),
  // and the server refuses it for a form of another device.
  await page.getByLabel('Anzahl Weltenbrecher').fill('7');
  await page.getByLabel('Zielart').selectOption('planet');
  await expect(
    page.getByLabel('Auftrag').locator('option', { hasText: 'Mondbruch' }),
  ).toHaveCount(0);
  const target = await page.evaluate(() => {
    const value = (id: string): number =>
      Number((document.querySelector(`#${id}`) as HTMLInputElement).value);
    return { g: value('t_g'), s: value('t_s'), p: value('t_p') };
  });
  const start = /\[(\d+):(\d+):(\d+)\]/.exec(
    await page.locator('#pinfo').innerText(),
  )!;
  expect(
    await refusal(page, {
      type: 'send',
      planet: `p${start[1]}_${start[2]}_${start[3]}`,
      mission: 'moonbreak',
      ships: { dstar: 7 },
      to: { ...target, kind: 'planet' },
    }),
  ).toBe('Mondbruch nur gegen einen Mond.');
  await page.getByLabel('Zielart').selectOption('moon');
  await sendMondbruch(page, a);

  // The report arrives with the next state (the badge of the menu, which a
  // phone keeps in its hidden side menu).
  const badge = page.locator('#menu [data-v=messages] .badge');
  await expect(badge).toBeAttached({ timeout: 15000 });
  await nav(page, 'messages');
  const battle = report(page, /^Kampfbericht .* – gewonnen/);
  await battle.locator('.t').click();
  await expect(battle).toContainText(
    'Der Angreifer hat die Schlacht gewonnen!',
  );
  await expect(battle).toContainText('Der Mond ist zerbrochen (Chance 100 %).');
  // The loot of a Sturmangriff: half of the moon's stock.
  await expect(battle).toContainText(
    'Erbeutet: Adamant 500 · Psikristall 500 · Promethium 500',
  );
  expect(await violations(page)).toEqual([]);

  // The owner reads that his moon is gone; it leaves his planet list.
  await page.click('[data-act=logout]');
  await login(page, b);
  await nav(page, 'messages');
  const hit = report(page, /^Feindkontakt! Mond \(Mond\)/);
  await hit.locator('.t').click();
  await expect(hit).toContainText(
    /Dein Mond bei \[\d+:\d+:\d+\] wurde zerstört\./,
  );
  await expect(hit).not.toContainText('Der Mond ist zerbrochen');
  await expect(
    page.getByLabel('Aktiver Planet').locator('option', { hasText: '(Mond)' }),
  ).toHaveCount(0);
  expect(await violations(page)).toEqual([]);
  expect(w.problems).toEqual([]);
}

test.describe('the Mondbruch (#95)', () => {
  test('a fleet with Weltenbrecher breaks a foreign moon; both sides read it in the battle report', async ({
    page,
  }) => {
    await mondbruch(page, 'Bruch');
  });

  test('the Mondbruch on a phone @phone', async ({ page }) => {
    await mondbruch(page, 'BruchTel');
  });
});
