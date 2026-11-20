// The planet limit per player (#237, okf/features/colonization.md): the admin
// sets it in the dialog „Neue Runde“, which shows a preview line of the limits
// and hides the extra fields while the research is off; in the new round the
// overview names the limit, a second Landnahme is refused with the count, and
// the research „Kolonialverwaltung“ has its line. The words that the issue
// gives (the preview, the refusal, the research line) are checked whole; the
// rest is checked by its numbers. A new round resets its universe, so this
// runs on the second server of the E2E start, the one of the mail and
// new-round specs (#68).
import { expect, test, type Page } from '@playwright/test';
import {
  lastToast,
  loginByCode,
  mailCli,
  mailSeed,
  nav,
  registerByMail,
  uniqueName,
  watch,
} from './helpers.ts';

const dialog = (page: Page) => page.locator('#modal');
const baseField = (page: Page) =>
  dialog(page).getByLabel(/^Maximale Planeten ohne Forschung/);
const researchSwitch = (page: Page) =>
  dialog(page).getByLabel('Kolonieforschung aktivieren');
const preview = (page: Page) => page.locator('#round-preview-colonies');

test.describe('the planet limit (#237)', () => {
  test('the admin sets a limit for the new round; a second Landnahme is refused with the count, and the research has its line', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const w = watch(page);
    const name = uniqueName('Grenze');
    await registerByMail(page, name);
    mailCli('admin', name);
    await loginByCode(page, name);

    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page.getByRole('button', { name: 'Neue Runde starten' }).click();
    await expect(
      page.getByText('Wirklich eine neue Runde starten?'),
    ).toBeVisible();

    // Without a limit, the preview says so (issue #237).
    await baseField(page).fill('0');
    await expect(preview(page)).toHaveText(
      'Vorschau: Unbegrenzte Planetenanzahl',
    );
    // The extra fields show only with the research (issue: „Hide the extra
    // fields while off“), and the research needs a base limit.
    const perLevel = dialog(page).getByLabel(
      'Zusätzliche Planeten je Forschungsstufe',
    );
    const maxLevel = dialog(page).getByLabel(/^Maximale Forschungsstufe/);
    await expect(perLevel).toBeHidden();
    await expect(maxLevel).toBeHidden();
    await researchSwitch(page).selectOption({ label: 'Ja' });
    await expect(preview(page)).toHaveText(
      'Mit Kolonieforschung muss die Grundgrenze größer als 0 sein.',
    );
    await expect(perLevel).toBeVisible();
    await expect(maxLevel).toBeVisible();

    // Two planets, two more per level, four levels: the issue's preview.
    await baseField(page).fill('2');
    await perLevel.fill('2');
    await maxLevel.fill('4');
    await expect(preview(page)).toHaveText(
      'Vorschau: Ohne Forschung: 2 Planeten · Stufe 1: 4 · Stufe 2: 6 · Stufe 3: 8 · Stufe 4: 10.',
    );
    await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
    await expect(lastToast(page)).toContainText('Neue Runde gestartet');

    // A Scholarium for the research list, three slots, an ark and fuel.
    mailSeed({
      name,
      b: { lab: 1 },
      research: { computer: 2 },
      ships: { colony: 2 },
      res: { m: 0, c: 0, d: 20000 },
    });
    await page.reload();
    await nav(page, 'overview');
    await expect(
      page.locator('.kv tr', { hasText: 'Planetengrenze' }),
    ).toContainText('Planeten: 1 / 2 · Kolonialverwaltung Stufe 0');
    await nav(page, 'research');
    const research = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Kolonialverwaltung/ }),
    });
    await expect(research).toContainText(
      'Kolonialverwaltung Stufe 0/4 · +2 Planeten je Stufe · nächste Stufe: maximal 4 Planeten',
    );

    // The first Landnahme fits (one planet and one on its way make two).
    await nav(page, 'galaxy');
    await page.getByText('zum Heimatsystem').click();
    const landnahme = page.getByRole('button', { name: 'Landnahme' });
    await landnahme.first().click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('colonize');
    await page.getByLabel('Anzahl Kolonistenarche').fill('1');
    await expect(page.locator('#t_limit')).toHaveText(
      'Planeten: 1 / 2 · Kolonialverwaltung Stufe 0',
    );
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');

    // The second one is refused with the count, and the form says so before.
    await nav(page, 'galaxy');
    await page.getByText('zum Heimatsystem').click();
    await landnahme.last().click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('colonize');
    await page.getByLabel('Anzahl Kolonistenarche').fill('1');
    const refusal =
      'Planetengrenze erreicht (2/2). Erforsche Kolonialverwaltung oder gib eine Kolonie auf.';
    await expect(page.locator('#t_limit')).toContainText(refusal);
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(refusal);

    // The limit is a setting of the server: back to none for the other specs.
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page
      .locator('#set_roundColonyResearch')
      .selectOption({ label: 'Nein' });
    await page.locator('#set_roundColonyBase').fill('0');
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await expect(page.locator('#set_roundColonyBase')).toHaveValue('0');
    mailCli('unadmin', name);
    expect(w.problems).toEqual([]);
  });
});
