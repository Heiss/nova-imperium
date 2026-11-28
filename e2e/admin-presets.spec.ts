// The presets of the round settings (#441, owner, 2026-11-27): the row
// „Voreinstellung“ with „Standard“ in the tab „Universum“ and in the dialog „Neue
// Runde“. A click asks first; „Abbrechen“ changes no field, „Umstellen“ fills
// the fields with the defaults and saves nothing (a reload shows the saved
// value); only the save applies them. Under „Universum“ the preset also sets
// the base values of the universe to the defaults of version 1 (owner,
// 2026-11-28); the universe of the specs is larger, so their save is refused
// as every too small value is. Before it saves, the spec types back every
// base value the page showed, so the shared universe keeps what the other
// specs set. The dialog „Neue Runde“ is filled and closed without a new round,
// as the universe is shared by the tests; the setting changed here is put
// back.
import { expect, test, type Page } from '@playwright/test';
import { UNIVERSE_SPECS } from '../src/core/universe.ts';
import { E2E_UNIVERSE } from './env.ts';
import { cli, nav, register, uniqueName, watch } from './helpers.ts';

const CAP = 'Mondchance höchstens (%)';
/** The base values of the universe, which a preset sets too (owner, 2026-11-28). */
const BASE_KEYS = UNIVERSE_SPECS.filter((s) => !s.key.startsWith('round')).map(
  (s) => s.key,
);
const QUESTION =
  'Sollen die Einstellungen auf die Voreinstellung „Standard“ umgestellt werden? Achtung: Erst „Speichern“ unten übernimmt die Änderung.';

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
      presets.getByRole('heading', { name: 'Voreinstellung' }),
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
    // The base values go to the defaults too; the universe of the specs has
    // planets beyond 2 galaxies, so that save is refused and nothing saved.
    const panel2 = await universe(page);
    const shown = await page.evaluate((keys) => {
      const value = (k: string) =>
        (document.getElementById(`set_${k}`) as HTMLInputElement).value;
      return Object.fromEntries(keys.map((k) => [k, value(k)]));
    }, BASE_KEYS);
    const again = panel2.locator('[data-presets=universe]');
    await again.getByRole('button', { name: 'Standard' }).click();
    await again.getByRole('button', { name: 'Umstellen' }).click();
    const galaxies = panel2.getByLabel('Galaxien', { exact: true });
    const systems = panel2.getByLabel('Systeme je Galaxie', { exact: true });
    await expect(galaxies).toHaveValue('2');
    await expect(systems).toHaveValue('50');
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'dort liegen schon Planeten',
    );
    // With the base values typed back, „Speichern“ applies the rest.
    expect(shown.galaxies).toBe(String(E2E_UNIVERSE.galaxies));
    for (const [key, value] of Object.entries(shown))
      await page.locator(`#set_${key}`).fill(value);
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
