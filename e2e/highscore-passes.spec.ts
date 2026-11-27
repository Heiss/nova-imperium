// The points and the highscore N times a day (#405, owner, 2026-11-25): the
// setting „Highscore-Aktualisierungen pro Tag (0 = Echtzeit)“ stands in the
// tab „Universum“ and in the dialog „Neue Runde“ with 3 by default, takes
// effect without a restart, and the highscore names the time of the last
// pass, „Stand: {Uhrzeit}“. The universe is shared by the tests: the setting
// is put back.
import { expect, test, type Page } from '@playwright/test';
import {
  boxes,
  cli,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

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
    // Next to the table, on its right (owner, 2026-11-26, B of #418); both
    // boxes in one call, as every render mounts the view anew (`anew`).
    const [line, table] = await boxes(
      page,
      '.scores-wrap > .stand',
      '.scores-wrap > .box',
    );
    expect(line).not.toBeNull();
    expect(table).not.toBeNull();
    expect(line!.x).toBeGreaterThanOrEqual(table!.x + table!.width);
    expect(line!.y).toBeLessThan(table!.y + table!.height);
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

/** Sets how Wirtschaft counts in the tab „Universum“ and saves (#422). */
async function economyBy(page: Page, label: string): Promise<void> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page
    .locator('#admin-panel-universe')
    .getByLabel('Wirtschaft zählt nach', { exact: true })
    .selectOption({ label });
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Einstellungen gespeichert.',
  );
}

test('the admin sets how Wirtschaft and Militär count, Anzahl by default; the highscore follows at once (#422)', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Zaehlart');
  await register(page, name);
  // Mines of level 25: 25 levels, about 3,800 points by resources.
  seed({ name, b: { metal: 25 } });
  cli('admin', name);
  await page.reload();
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  const panel = page.locator('#admin-panel-universe');
  for (const label of ['Wirtschaft zählt nach', 'Militär zählt nach']) {
    const select = panel.getByLabel(label, { exact: true });
    await expect(select.locator('option:checked')).toHaveText('Anzahl');
    await expect(select.locator('option')).toHaveText(['Anzahl', 'Rohstoffen']);
  }
  // In „Neue Runde“ too; the dialog is closed without a new round.
  await panel.getByRole('button', { name: 'Neue Runde starten' }).click();
  for (const label of ['Wirtschaft zählt nach', 'Militär zählt nach'])
    await expect(
      page
        .locator('#modal')
        .getByLabel(label, { exact: true })
        .locator('option:checked'),
    ).toHaveText('Anzahl');
  await page.keyboard.press('Escape');
  const own = page.locator('.scores tr.me td.n').last();
  try {
    await nav(page, 'highscore');
    await page.getByRole('button', { name: 'Wirtschaft' }).click();
    await expect(own).toHaveText('25');
    await economyBy(page, 'Rohstoffen');
    await nav(page, 'highscore');
    await page.getByRole('button', { name: 'Wirtschaft' }).click();
    await expect(page.locator('.dim', { hasText: '1 Punkt' })).toHaveText(
      '1 Punkt = 1.000 verbaute Rohstoffe (Gebäude, Forschung, Sonnenreliquiare).',
    );
    expect(Number((await own.innerText()).replace(/\D/g, ''))).toBeGreaterThan(
      1000,
    );
  } finally {
    await economyBy(page, 'Anzahl');
  }
  cli('unadmin', name);
  expect(w.problems).toEqual([]);
});

/** Sets „Highscore zeigt“ in the tab „Universum“ and saves (#422, 175a). */
async function highscoreShows(page: Page, label: string): Promise<void> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page
    .locator('#admin-panel-universe')
    .getByLabel('Highscore zeigt', { exact: true })
    .selectOption({ label });
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Einstellungen gespeichert.',
  );
}

test('„Highscore zeigt“: every category by default, Gesamt only, or nothing with the page hidden (#422, 175a to 182a)', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Sichtbar');
  await register(page, name);
  seed({ name, b: { metal: 15 } });
  cli('admin', name);
  await page.reload();
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  const select = page
    .locator('#admin-panel-universe')
    .getByLabel('Highscore zeigt', { exact: true });
  await expect(select.locator('option:checked')).toHaveText('alle Wertungen');
  await expect(select.locator('option')).toHaveText([
    'alle Wertungen',
    'nur Gesamt',
    'nichts',
  ]);
  try {
    // „nur Gesamt“: the Gesamt button alone.
    await highscoreShows(page, 'nur Gesamt');
    await nav(page, 'highscore');
    await expect(page.locator('[data-act=highscore]')).toHaveText(['Gesamt']);
    // „nichts“: no menu entry, no page, the own points without a place.
    await highscoreShows(page, 'nichts');
    await expect(page.locator('#menu [data-v=highscore]')).toHaveCount(0);
    await page.goto('/?view=highscore');
    await expect(page.locator('h2')).not.toHaveText('Highscore');
    await nav(page, 'overview');
    const points = page
      .locator('tr', { hasText: 'Punkte' })
      .locator('td')
      .last();
    await expect(points).not.toContainText('Platz');
    await expect(points).toHaveText(/^[\d.]+$/);
  } finally {
    await highscoreShows(page, 'alle Wertungen');
  }
  await expect(page.locator('#menu [data-v=highscore]')).toHaveCount(1);
  cli('unadmin', name);
  expect(w.problems).toEqual([]);
});
