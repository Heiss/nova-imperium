// The explanations of the admin panel (#358): the „?“ beside a setting of
// the tab „Universum“ opens a side panel with its text and its table, Esc
// and „Schließen“ close it and give the focus back to the „?“; the keyboard
// opens it too;
// in the dialog „Neue Runde“ the panel opens over the dialog and „Schließen“
// leaves the dialog open. Desktop and phone (full width).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cli, nav, register, uniqueName, watch } from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const SPEED = 'Tempo (Faktor)';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** A new admin on the tab „Universum“. */
async function universe(page: Page): Promise<void> {
  const name = uniqueName('Erklaerer');
  await register(page, name);
  expect(cli('admin', name)).toContain(`${name} is now admin.`);
  await page.reload();
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
}

const panel = (page: Page) => page.locator('#admin-explain-panel');

for (const phone of ['', ' @phone'])
  test(`the „?“ of a setting opens its explanation and its table, Esc closes it (#358)${phone}`, async ({
    page,
  }) => {
    const w = watch(page);
    await universe(page);
    const ask = page.locator('#axqu_speed');
    await expect(ask).toHaveAttribute('aria-expanded', 'false');
    await ask.click();
    await expect(panel(page)).toBeVisible();
    await expect(ask).toHaveAttribute('aria-expanded', 'true');
    await expect(
      panel(page).getByRole('heading', { name: SPEED }),
    ).toBeVisible();
    await expect(panel(page)).toContainText('Das Tempo teilt alle');
    // The table: the minimum, two values in between, the maximum, the current value.
    const head = panel(page).locator('thead th');
    await expect(head).toHaveText([
      SPEED,
      '1',
      '34',
      '67',
      '100',
      /\(jetzt\)$/,
    ]);
    await expect(panel(page).locator('tbody tr').first()).toContainText(
      'Stufe 10: Bauzeit',
    );
    await expect(panel(page)).toBeFocused();
    expect(await violations(page)).toEqual([]);
    if (phone) {
      // On a phone the panel takes the whole width.
      const box = (await panel(page).boundingBox())!;
      expect(box.width).toBe(page.viewportSize()!.width);
    }
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(ask).toBeFocused();
    // The keyboard opens it too; the same „?“ closes it again.
    await page.keyboard.press('Enter');
    await expect(panel(page)).toContainText('Das Tempo teilt alle');
    // On a phone the panel covers the „?“: „Schließen“ closes it.
    await panel(page).getByRole('button', { name: 'Schließen' }).click();
    await expect(panel(page)).toHaveCount(0);
    await expect(ask).toBeFocused();
    expect(w.problems).toEqual([]);
  });

test('the „?“ in „Neue Runde“ opens the explanation over the dialog, „Schließen“ keeps the dialog (#358)', async ({
  page,
}) => {
  const w = watch(page);
  await universe(page);
  await page.getByRole('button', { name: 'Neue Runde starten' }).click();
  const dialog = page.locator('#modal');
  const ask = dialog.locator('#axqr_roundGuilds');
  await ask.click();
  await expect(panel(page)).toContainText(
    'Schaltet die Gilden mit Chat und Rängen',
  );
  // A switch of the round has no table.
  await expect(panel(page).locator('table')).toHaveCount(0);
  await panel(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(ask).toBeFocused();
  await expect(dialog).toBeVisible();
  expect(w.problems).toEqual([]);
});
