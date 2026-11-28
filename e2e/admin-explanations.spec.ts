// The explanations of the admin panel (#358): the „?“ beside a setting of
// the tab „Universum“ opens a side panel with its text and its table, Esc
// and „Schließen“ close it and give the focus back to the „?“; the keyboard
// opens it too;
// in the dialog „Neue Runde“ the panel opens inside the dialog, and Esc and
// „Schließen“ leave the dialog open with what was typed (PR #471); the panel
// keeps the focus where the admin put it and closes with the view and the
// dialog; „Eigener Wert“ adds the column of a typed value of a setting with
// a formula (part 2). Desktop and phone (full width).
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

test('the „?“ in „Neue Runde“ opens the explanation inside the dialog; Esc closes only the panel and keeps what was typed (#358, PR #471)', async ({
  page,
}) => {
  const w = watch(page);
  await universe(page);
  await page.getByRole('button', { name: 'Neue Runde starten' }).click();
  const dialog = page.locator('#modal');
  await dialog.locator('#round-market-fee').fill('7');
  const ask = dialog.locator('#axqr_roundGuilds');
  await ask.click();
  // Inside the modal dialog, so a screen reader reads it as part of it.
  await expect(dialog.locator('#admin-explain-panel')).toContainText(
    'Schaltet die Gilden mit Chat und Rängen',
  );
  // A switch of the round has no table.
  await expect(panel(page).locator('table')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#round-market-fee')).toHaveValue('7');
  await expect(ask).toBeFocused();
  await ask.click();
  await panel(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(ask).toBeFocused();
  await expect(dialog).toBeVisible();
  // Closing the dialog closes its explanation: it does not open with the next dialog.
  await ask.click();
  await expect(panel(page)).toBeVisible();
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toBeHidden();
  await expect(panel(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Neue Runde starten' }).click();
  await expect(dialog.locator('#round-market-fee')).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  await expect(dialog.locator('#axqr_roundGuilds')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  // Esc without a panel closes the dialog as before.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  expect(w.problems).toEqual([]);
});

test('the explanation keeps the focus where the admin put it and closes when the admin leaves the view (#358, PR #471)', async ({
  page,
}) => {
  const w = watch(page);
  await universe(page);
  await page.locator('#axqu_speed').click();
  await expect(panel(page)).toBeFocused();
  const close = panel(page).getByRole('button', { name: 'Schließen' });
  await close.focus();
  // A state of the server comes in (the poll, every 4 s): the focus stays.
  await page.waitForResponse((r) => r.url().includes('/api/state'));
  await expect(close).toBeFocused();
  await nav(page, 'overview');
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await expect(page.locator('#axqu_speed')).toBeVisible();
  await expect(panel(page)).toHaveCount(0);
  expect(w.problems).toEqual([]);
});

for (const phone of ['', ' @phone'])
  test(`„Eigener Wert“ adds a column of a typed value, refuses one outside the range and forgets it when the panel closes (#358, part 2)${phone}`, async ({
    page,
  }) => {
    const w = watch(page);
    await universe(page);
    const ask = page.locator('#axqu_speed');
    await ask.click();
    const own = panel(page).getByLabel('Eigener Wert');
    await expect(own).toHaveAttribute('min', '1');
    await expect(own).toHaveAttribute('max', '100');
    await own.fill('7');
    const head = panel(page).locator('thead th');
    await expect(head.last()).toHaveText('7 (eigener Wert)');
    await expect(head).toHaveCount(7);
    // Typing keeps the focus in the field, over a poll too.
    await expect(own).toBeFocused();
    await page.waitForResponse((r) => r.url().includes('/api/state'));
    await expect(own).toBeFocused();
    await expect(head.last()).toHaveText('7 (eigener Wert)');
    expect(await violations(page)).toEqual([]);
    // A text the number field cannot read is refused, and the text stays (PR #476).
    await own.fill('');
    await own.pressSequentially('1e');
    await expect(panel(page)).toContainText(
      `${SPEED}: ganze Zahl von 1 bis 100.`,
    );
    await expect(own).toHaveAttribute('aria-invalid', 'true');
    await expect(head).toHaveCount(6);
    expect(
      await own.evaluate((el: HTMLInputElement) => el.validity.badInput),
    ).toBe(true);
    await own.fill('0');
    await expect(panel(page)).toContainText(
      `${SPEED}: ganze Zahl von 1 bis 100.`,
    );
    await expect(own).toHaveAttribute('aria-invalid', 'true');
    await expect(head).toHaveCount(6);
    expect(await violations(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(ask).toBeFocused();
    await ask.click();
    await expect(panel(page).getByLabel('Eigener Wert')).toHaveValue('');
    await expect(head).toHaveCount(6);
    // A setting without a formula has no field.
    await panel(page).getByRole('button', { name: 'Schließen' }).click();
    await page.locator('#axqu_positions').click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByLabel('Eigener Wert')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });
