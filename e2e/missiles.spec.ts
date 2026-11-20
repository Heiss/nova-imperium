// The missiles of #54 (okf/features/missiles.md): the Raketenkrypta shows
// the places its missiles take and limits the order of the defense; the
// Raketenangriff starts in the Sternenkarte at a foreign planet in range, the
// Abfangraketen of the target stop one missile each, the rest destroys
// defense, the main target first, and nothing is rebuilt. The flight is set
// to arrive now with e2e/seed.ts. The target is a colony of another player
// in the attacker's home system, so the impulse drive 1 (4 systems) reaches it.
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  galaxyAction,
  logout,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const RICH = { m: 1e7, c: 1e7, d: 1e7 };

/** The coordinates of the shown place, from the header. */
async function here(page: Page): Promise<{ g: number; s: number; p: number }> {
  const header = await page.locator('#pinfo').innerText();
  const [, g, s, p] = /\[(\d+):(\d+):(\d+)\]/.exec(header)!;
  return { g: Number(g), s: Number(s), p: Number(p) };
}

/** The row of a planet on the Sternenkarte, by its name. */
const planetRow = (page: Page, name: string): Locator =>
  page.locator('table.gal tr').filter({ hasText: name });

const report = (page: Page, title: string | RegExp): Locator =>
  page.locator('.rep').filter({ has: page.locator('.t', { hasText: title }) });

/**
 * An attacker with a Raketenkrypta of level 4, `ipm` Orbitalraketen and the
 * impulse drive at `impulse`, and a target player whose colony at position
 * 3 of the attacker's home system has 100 Raketenbatterien, 10
 * Massebeschleuniger and one Abfangrakete. The target has research enough
 * that the noob protection does not shield it.
 */
async function setup(
  page: Page,
  impulse: number,
): Promise<{ attacker: string; colony: string; at: string }> {
  const target = uniqueName('RakZiel');
  const colony = uniqueName('Rakziel');
  const attacker = uniqueName('Rakete');
  await register(page, target);
  await logout(page);
  await register(page, attacker);
  const home = await here(page);
  seed({
    name: target,
    research: { energy: 12 },
    colony: {
      g: home.g,
      s: home.s,
      p: 3,
      name: colony,
      def: { rl: 100, gauss: 10, abm: 1 },
    },
  });
  seed({
    name: attacker,
    res: RICH,
    b: { yard: 1, silo: 4 },
    def: { ipm: 3 },
    research: { impulse },
  });
  await page.reload();
  return { attacker, colony, at: `[${home.g}:${home.s}:3]` };
}

/** Opens the Sternenkarte at the home system. */
async function homeSystem(page: Page): Promise<void> {
  await nav(page, 'galaxy');
  await page.getByText('zum Heimatsystem').click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

test.describe('missiles (#54)', () => {
  test('the Raketenkrypta shows its places and limits the missiles', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Krypta');
    await register(page, name);
    seed({
      name,
      res: RICH,
      b: { yard: 1, silo: 2 },
      def: { abm: 16 },
      research: { impulse: 1 },
    });
    await page.reload();
    await nav(page, 'buildings');
    const silo = page.locator('.item', { hasText: 'Raketenkrypta' });
    await expect(silo).toContainText('Belegt: 16 / 20 Plätze');
    await nav(page, 'defense');
    const abm = page.locator('.item', { hasText: 'Abfangrakete' }).first();
    await expect(abm).toContainText('(vorhanden: 16)');
    await expect(abm.locator('[data-act=maxq]')).toHaveText('(max 4)');
    // An Orbitalrakete needs level 4 of the Raketenkrypta.
    // By its name: the text of the Abfangrakete names the Orbitalrakete too.
    const ipm = page
      .locator('.item')
      .filter({ has: page.locator('.nm', { hasText: /^Orbitalrakete/ }) });
    await expect(ipm).toContainText('Das Wissen ist noch verschlossen');
    await abm.getByLabel('Anzahl').fill('5');
    await abm.getByRole('button', { name: 'Bauen', exact: true }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Nicht genug Platz in der Raketenkrypta.',
    );
    expect(w.problems).toEqual([]);
  });

  test('a Raketenangriff hits a foreign planet in range; the Abfangraketen stop one missile first', async ({
    page,
  }) => {
    const w = watch(page);
    const { attacker, colony, at } = await setup(page, 1);
    await homeSystem(page);
    const button = planetRow(page, colony).getByRole('button', {
      name: `Raketenangriff auf ${colony}`,
    });
    await button.click();
    const dialog = page.locator('#modalIn');
    await expect(dialog).toContainText(`Raketenangriff auf ${colony} ${at}`);
    await dialog.getByLabel('Anzahl').fill('2');
    await dialog.getByLabel('Hauptziel').selectOption({
      label: 'Massebeschleuniger',
    });
    await dialog.getByRole('button', { name: 'Starten' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      `2 Orbitalraketen unterwegs nach ${at}.`,
    );
    await nav(page, 'overview');
    await expect(page.locator('.fl-missile')).toContainText('Raketenangriff');
    await expect(
      page.locator('.fl-missile').getByRole('button', { name: 'Rückruf' }),
    ).toHaveCount(0);

    seed({ name: attacker, landFleet: 'missile' });
    await page.reload();
    await nav(page, 'messages');
    const hit = report(page, `Raketenangriff ${at}`);
    await expect(hit).toBeVisible({ timeout: 15000 });
    await hit.locator('.t').click();
    // One stopped; one hits: 3 Massebeschleuniger, the rest 7 Raketenbatterien.
    await expect(hit).toContainText(
      `1 Orbitalraketen trafen ${at}; 1 wurden abgefangen. Zerstört: 3 Massebeschleuniger, 7 Raketenbatterie.`,
    );
    expect(w.problems).toEqual([]);
  });

  test('offers no Raketenangriff out of range @phone', async ({ page }) => {
    const w = watch(page);
    const { colony } = await setup(page, 0);
    await homeSystem(page);
    await expect(planetRow(page, colony)).toBeVisible();
    // On a phone the actions are in the sheet of the row (#189).
    await expect(
      await galaxyAction(page, planetRow(page, colony), /Raketenangriff/),
    ).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });
});
