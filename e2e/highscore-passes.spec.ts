// The points and the highscore N times a day (#405, owner, 2026-11-25): the
// setting „Highscore-Aktualisierungen pro Tag (0 = Echtzeit)“ stands in the
// tab „Universum“ and in the dialog „Neue Runde“ with 3 by default, takes
// effect without a restart, and the highscore names the time of the last
// pass, „Stand: {Uhrzeit}“. The universe is shared by the tests: the setting
// is put back.
import { expect, test, type Page } from '@playwright/test';
import { cli, nav, register, uniqueName, watch } from './helpers.ts';

const LABEL = 'Highscore-Aktualisierungen pro Tag (0 = Echtzeit)';

async function saveUniverse(page: Page, value: string): Promise<void> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  const field = page
    .locator('#admin-panel-universe')
    .getByLabel(LABEL, { exact: true });
  await field.fill(value);
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Einstellungen gespeichert.',
  );
}

test('the admin sets how often the highscore is computed; the highscore names the time (#405)', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Wertung');
  await register(page, name);
  cli('admin', name);
  await page.reload();
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  const field = page
    .locator('#admin-panel-universe')
    .getByLabel(LABEL, { exact: true });
  await expect(field).toHaveValue('3');
  await expect(field).toHaveAttribute('min', '0');
  await expect(field).toHaveAttribute('max', '24');
  // In „Neue Runde“ too, with 3; the dialog is closed without a new round.
  await page
    .locator('#admin-panel-universe')
    .getByRole('button', { name: 'Neue Runde starten' })
    .click();
  await expect(
    page.locator('#modal').getByLabel(LABEL, { exact: true }),
  ).toHaveValue('3');
  await page.keyboard.press('Escape');
  try {
    // Live (0): a pass at most 10 s old, its time in the highscore.
    await saveUniverse(page, '0');
    await page.reload();
    await nav(page, 'highscore');
    await expect(page.locator('h2')).toContainText('Highscore');
    const stand = page.getByText(/^Stand: \d{2}:\d{2}$/);
    await expect(stand).toBeVisible();
    // Next to the table, on its right (owner, 2026-11-26, B of #418).
    const line = (await stand.boundingBox())!;
    const table = (await page.locator('.scores-wrap > .box').boundingBox())!;
    expect(line.x).toBeGreaterThanOrEqual(table.x + table.width);
    expect(line.y).toBeLessThan(table.y + table.height);
    const clock = new Date().toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const before = new Date(Date.now() - 60_000).toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
    expect([`Stand: ${clock}`, `Stand: ${before}`]).toContain(
      await stand.textContent(),
    );
  } finally {
    await saveUniverse(page, '3');
  }
  cli('unadmin', name);
  expect(w.problems).toEqual([]);
});
