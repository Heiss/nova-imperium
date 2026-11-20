// The level overview (#187, okf/features/level-overview.md): a second icon „▤“
// next to the „?“ of a building unfolds the table of its next levels, with the
// mouse and with the keyboard (`aria-expanded`, `aria-controls`); the rows are
// the next 3 levels and then the multiples of 5 up to 20 (D1: from level 3 on,
// 4, 5, 6, 10, 15, 20). The option „Stufenübersicht“ in „Hilfe & Optionen“ is
// stored per player: new players get the icon (D5), „Immer anzeigen“ shows
// every table without the icon, „Ausblenden“ neither, and the choice stays
// over a reload. The words of the columns are drafts [V]; the checks hold the
// button name the issue gives and the levels. Desktop and phone.
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  nav,
  openAllRows,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

/** The ▤ of the Adamant-Tiefbohrung and the box that holds its table. */
const icon = (page: Page): Locator =>
  page.getByRole('button', {
    name: 'Stufenübersicht zu Adamant-Tiefbohrung',
    exact: true,
  });
const table = (page: Page): Locator => page.locator('#lv_metal');
/** The levels of the rows of the table, as shown. */
const levels = (page: Page): Locator => table(page).locator('tbody th');

/** Chooses a mode of the option and saves it. */
async function choose(page: Page, label: string): Promise<void> {
  await nav(page, 'help');
  await page.getByLabel('Stufenübersicht:').selectOption({ label });
  await page.click('[data-act=saveopt]');
  await expect(page.locator('.toast').last()).toBeVisible();
}

for (const phone of ['', ' @phone'])
  test(`the ▤ unfolds the table of the next levels with the mouse and the keyboard${phone}`, async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Stufenplan');
    await register(page, name);
    // Level 3: the rows are 4, 5, 6 and then 10, 15, 20 (D1).
    seed({ name, b: { metal: 3 } });
    await page.reload();
    await nav(page, 'buildings');
    await openAllRows(page);

    // New players get the icon (D5); the table is folded.
    await expect(icon(page)).toBeVisible();
    await expect(icon(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(icon(page)).not.toHaveAttribute('aria-controls');
    await expect(table(page)).toHaveCount(0);

    // The mouse unfolds it.
    await icon(page).click();
    await expect(icon(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(icon(page)).toHaveAttribute('aria-controls', 'lv_metal');
    await expect(levels(page)).toHaveText(['4', '5', '6', '10', '15', '20']);
    // A region that scrolls sideways is reached by the keyboard.
    await expect(
      table(page).getByRole('region', { name: 'Stufen' }),
    ).toHaveAttribute('tabindex', '0');

    // The keyboard folds it again, and unfolds it with the space bar.
    await icon(page).focus();
    await page.keyboard.press('Enter');
    await expect(icon(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(table(page)).toHaveCount(0);
    await icon(page).focus();
    await page.keyboard.press('Space');
    await expect(icon(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(levels(page)).toHaveCount(6);
    // The button keeps the focus, so the keyboard can fold it.
    await expect(icon(page)).toBeFocused();
    expect(w.problems).toEqual([]);
  });

test('the option „Stufenübersicht“ shows every table, none or the icon, and keeps the choice over a reload', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Stufenwahl');
  await register(page, name);
  seed({ name, b: { metal: 3 } });
  await page.reload();

  await nav(page, 'help');
  await expect(page.getByLabel('Stufenübersicht:')).toHaveValue('icon');

  // „Immer anzeigen“: no icon, every table is in its row.
  await choose(page, 'Immer anzeigen');
  await page.reload();
  await nav(page, 'help');
  await expect(page.getByLabel('Stufenübersicht:')).toHaveValue('always');
  await nav(page, 'buildings');
  await expect(icon(page)).toHaveCount(0);
  await expect(levels(page)).toHaveText(['4', '5', '6', '10', '15', '20']);

  // „Ausblenden“: neither.
  await choose(page, 'Ausblenden');
  await page.reload();
  await nav(page, 'help');
  await expect(page.getByLabel('Stufenübersicht:')).toHaveValue('hidden');
  await nav(page, 'buildings');
  await expect(icon(page)).toHaveCount(0);
  await expect(table(page)).toHaveCount(0);

  // Back to the icon.
  await choose(page, 'Als ▤-Symbol');
  await nav(page, 'buildings');
  await expect(icon(page)).toBeVisible();
  expect(w.problems).toEqual([]);
});
