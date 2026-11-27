// The presets of the round settings (#441, owner, 2026-11-27): the row
// „Regelset“ with „Standard“ in the tab „Universum“ and in the dialog „Neue
// Runde“. A click asks first; „Abbrechen“ changes no field, „Umstellen“ fills
// the fields with the defaults and saves nothing (a reload shows the saved
// value); only the save applies them. The dialog „Neue Runde“ is filled and
// closed without a new round, as the universe is shared by the tests; the
// setting changed here is put back.
import { expect, test, type Page } from '@playwright/test';
import { cli, nav, register, uniqueName, watch } from './helpers.ts';

const CAP = 'Mondchance höchstens (%)';
const QUESTION =
  'Sollen die Einstellungen auf das Regelset „Standard“ umgestellt werden? Achtung: Erst „Speichern“ unten übernimmt die Änderung.';

async function universe(page: Page) {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  return page.locator('#admin-panel-universe');
}

async function saveCap(page: Page, value: string): Promise<void> {
  const panel = await universe(page);
  await panel.getByLabel(CAP, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Einstellungen gespeichert.',
  );
}

test('the preset „Standard“ asks, fills the fields and saves only with „Speichern“ (#441)', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Regelwart');
  await register(page, name);
  cli('admin', name);
  await page.reload();
  try {
    await saveCap(page, '35');
    const panel = await universe(page);
    const cap = panel.getByLabel(CAP, { exact: true });
    const presets = panel.locator('[data-presets=universe]');
    await expect(
      presets.getByRole('heading', { name: 'Regelset' }),
    ).toBeVisible();
    // „Abbrechen“ changes nothing.
    await presets.getByRole('button', { name: 'Standard' }).click();
    await expect(presets.getByRole('alertdialog')).toContainText(QUESTION);
    await presets.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(presets.getByRole('alertdialog')).toHaveCount(0);
    await expect(cap).toHaveValue('35');
    // „Umstellen“ fills the field and saves nothing: a reload shows 35.
    await presets.getByRole('button', { name: 'Standard' }).click();
    await presets.getByRole('button', { name: 'Umstellen' }).click();
    await expect(cap).toHaveValue('20');
    await page.reload();
    await expect(
      (await universe(page)).getByLabel(CAP, { exact: true }),
    ).toHaveValue('35');
    // Then „Speichern“ applies it.
    const again = (await universe(page)).locator('[data-presets=universe]');
    await again.getByRole('button', { name: 'Standard' }).click();
    await again.getByRole('button', { name: 'Umstellen' }).click();
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Einstellungen gespeichert.',
    );
    await page.reload();
    await expect(
      (await universe(page)).getByLabel(CAP, { exact: true }),
    ).toHaveValue('20');

    // In „Neue Runde“ the dialog's fields are filled; it is closed without a new round.
    await saveCap(page, '35');
    await (
      await universe(page)
    )
      .getByRole('button', { name: 'Neue Runde starten' })
      .click();
    const modal = page.locator('#modal');
    const field = modal.getByLabel(CAP, { exact: true });
    await expect(field).toHaveValue('35');
    const row = modal.locator('[data-presets=round]');
    await row.getByRole('button', { name: 'Standard' }).click();
    await expect(row.getByRole('alertdialog')).toContainText(QUESTION);
    await row.getByRole('button', { name: 'Umstellen' }).click();
    await expect(field).toHaveValue('20');
    await expect(modal.getByLabel('Gilden (mit Chat)')).toBeChecked();
    await page.keyboard.press('Escape');
  } finally {
    await saveCap(page, '20');
  }
  cli('unadmin', name);
  expect(w.problems).toEqual([]);
});
