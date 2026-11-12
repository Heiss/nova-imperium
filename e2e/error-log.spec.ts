import { readFileSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { cli, nav, register, seed, uniqueName, watch } from './helpers.ts';

// Error log and problem reports (issue #126): the form in „Hilfe &
// Optionen“, „Problem melden“ behind every error message, the admin tab
// „Fehler“ and its ZIP download.

const REQUEST = '0f8e2b7a-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
const THANKS = 'Danke, die Meldung ist angekommen.';

const jsonLines = (data: Uint8Array | undefined): Record<string, unknown>[] =>
  strFromU8(data!)
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

/** A date for <input type="date"> in local time, `back` calendar days ago. */
const dateValue = (time: number, back = 0): string => {
  const d = new Date(time);
  d.setDate(d.getDate() - back);
  const two = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

async function sendReport(page: Page, form: Locator, text: string) {
  await form.getByLabel('Was ist passiert?').fill(text);
  await form.getByRole('button', { name: 'Absenden' }).click();
  await expect(page.locator('.toast').last()).toHaveText(THANKS);
}

/** The next game action fails with a 500 and a known request ID. */
async function failNextAction(page: Page): Promise<void> {
  await page.route(
    '**/api/action',
    (route) =>
      route.fulfill({
        status: 500,
        headers: { 'x-request-id': REQUEST },
        json: { error: 'Serverfehler.' },
      }),
    { times: 1 },
  );
}

/** Opens „Problem melden“ of the error message of a failed build. */
async function reportFromToast(page: Page): Promise<Locator> {
  await failNextAction(page);
  const reported = page.waitForResponse('**/api/errors');
  await page.click('[data-act=build][data-k=metal]');
  const toast = page.locator('.toast.err').last();
  await expect(toast).toContainText(`Serverfehler. Vorgang: ${REQUEST}`);
  // The failed call went into the error log on its own.
  expect((await reported).status()).toBe(200);
  await toast.getByRole('button', { name: 'Problem melden' }).click();
  const dialog = page.locator('#reportform-dialog');
  await expect(dialog).toContainText('Seite: buildings');
  await expect(dialog).toContainText(`Letzter Vorgang: ${REQUEST}`);
  await expect(dialog).toContainText('Meldung: Serverfehler.');
  await expect(dialog.getByLabel('Was ist passiert?')).toBeFocused();
  return dialog;
}

async function openErrorTab(page: Page, name: string): Promise<Locator> {
  cli('admin', name);
  await page.reload();
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Fehler' }).click();
  const tab = page.locator('#admin-errors');
  await expect(tab.getByRole('group', { name: 'Fehlerseiten' })).toBeVisible();
  return tab;
}

async function downloadZip(page: Page, tab: Locator) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    tab.getByRole('button', { name: 'Herunterladen' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(
    /^nova-imperium-fehler-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.zip$/,
  );
  return unzipSync(readFileSync(await download.path()));
}

test.describe('error log and problem reports (#126)', () => {
  test('a player reports a problem in „Hilfe & Optionen“', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Melder'));
    await nav(page, 'help');
    const form = page.locator('#reportform');
    await expect(form).toContainText('Seite: help');
    await expect(form).toContainText(/Letzter Vorgang: [0-9a-f-]{36}/);
    await expect(form.getByLabel('Was ist passiert?')).toHaveAttribute(
      'maxlength',
      '1000',
    );
    await sendReport(page, form, 'Die Flotte ist verschwunden.');
    await expect(form.getByLabel('Was ist passiert?')).toHaveValue('');
    expect(w.problems).toEqual([]);
  });

  test('an error message offers „Problem melden“; the admin sees errors and reports under „Fehler“', async ({
    page,
  }) => {
    const name = uniqueName('Pech');
    await register(page, name);
    await nav(page, 'buildings');
    const dialog = await reportFromToast(page);
    await sendReport(page, dialog, 'Der Ausbau ging nicht.');
    await expect(dialog).toHaveCount(0);
    // A script error of the page is reported too.
    const reported = page.waitForResponse('**/api/errors');
    await page.evaluate(() =>
      setTimeout(() => {
        throw new Error('E2E-Skriptfehler');
      }),
    );
    expect((await reported).status()).toBe(200);

    const tab = await openErrorTab(page, name);
    const report = tab.getByRole('row', { name: /Der Ausbau ging nicht/ });
    await expect(report).toContainText('Problemmeldung');
    await expect(report).toContainText(name);
    await expect(report).toContainText('buildings / toast');
    const failed = tab.getByRole('row', { name: /HTTP 500: \/api\/action/ });
    await expect(failed.first()).toContainText('Browserfehler');
    await expect(
      tab.getByRole('row', { name: /E2E-Skriptfehler/ }).first(),
    ).toContainText(name);
    await report.getByText(/^Eintrag \d+$/).click();
    await expect(report).toContainText(`Vorgang ${REQUEST}`);
    await tab.getByLabel('Art').selectOption('report');
    await expect(
      tab.getByRole('row', { name: /Browserfehler|Serverfehler/ }),
    ).toHaveCount(0);
    await expect(report).toBeVisible();
  });

  test('the admin pages the errors and downloads them as a ZIP, audited', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Pruefer');
    await register(page, name);
    for (let i = 0; i < 11; i++) seed({ name, serverError: `Testfehler ${i}` });
    const tab = await openErrorTab(page, name);
    await expect(tab.getByLabel('Anzahl je Seite')).toHaveValue('10');
    await tab.getByLabel('Art').selectOption('server');
    await expect(tab.getByRole('row', { name: /Testfehler 10/ })).toContainText(
      'Serverfehler',
    );
    await expect(
      tab.getByRole('button', { name: 'Erste Seite' }),
    ).toBeDisabled();
    await expect(tab.locator('tbody tr')).toHaveCount(10);
    await tab.getByRole('button', { name: 'Nächste Seite' }).click();
    await expect(
      tab.getByRole('group', { name: 'Fehlerseiten' }),
    ).toContainText('Seite 2 von');
    await expect(tab.getByText('Ältere Einträge')).toBeVisible();
    await tab.getByLabel('Anzahl je Seite').selectOption('25');
    await expect(tab.getByRole('row', { name: /Testfehler 0/ })).toBeVisible();

    // 7 calendar days: today and the six before.
    await expect(tab.getByLabel('Zeitraum von')).toHaveValue(
      dateValue(Date.now(), 6),
    );
    await expect(tab.getByLabel('bis')).toHaveValue(dateValue(Date.now()));
    const files = await downloadZip(page, tab);
    expect(Object.keys(files).sort()).toEqual([
      'audit.jsonl',
      'errors.jsonl',
      'reports.jsonl',
    ]);
    expect(jsonLines(files['errors.jsonl'])).toContainEqual(
      expect.objectContaining({
        kind: 'server',
        player: name,
        action: 'POST /api/action',
        message: 'Error: Testfehler 3',
      }),
    );
    expect(jsonLines(files['audit.jsonl'])).toContainEqual(
      expect.objectContaining({
        actor: name,
        category: 'admin.read',
        action: 'errors',
      }),
    );
    expect(strFromU8(files['errors.jsonl']!)).not.toContain('@example.org');

    // The download itself is an admin read in the event log.
    await page.getByRole('tab', { name: 'Ereignisprotokoll' }).click();
    await page.getByLabel('Aktion', { exact: true }).fill('errorDownload');
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    await expect(
      page.getByRole('row', { name: /admin.read \/ errorDownload/ }),
    ).toContainText(name);
    expect(w.problems).toEqual([]);
  });

  test('a late answer to a report closes no dialog opened since (#128)', async ({
    page,
  }) => {
    await register(page, uniqueName('Spaet'));
    await nav(page, 'buildings');
    const dialog = await reportFromToast(page);
    let release = (): void => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(
      '**/api/report',
      async (route) => {
        await held;
        await route.continue();
      },
      { times: 1 },
    );
    await dialog.getByLabel('Was ist passiert?').fill('Langsame Meldung.');
    await dialog.getByRole('button', { name: 'Absenden' }).click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await nav(page, 'help');
    await page.click('[data-act=deleteAccount]');
    const other = page.locator('#deleteaccountform');
    await expect(other).toBeVisible();
    release();
    await expect(page.locator('.toast').last()).toHaveText(THANKS);
    await expect(other).toBeVisible();
  });

  test('a lost session during the download goes back to the login (#128)', async ({
    page,
  }) => {
    const name = uniqueName('Abgelaufen');
    await register(page, name);
    const tab = await openErrorTab(page, name);
    await page.route('**/api/admin/errors/download', (route) =>
      route.fulfill({ status: 401, json: { error: 'Bitte einloggen.' } }),
    );
    await tab.getByRole('button', { name: 'Herunterladen' }).click();
    await expect(page.locator('.auth .hd')).toHaveText('Login');
  });

  test('a failure of an outdated list request stays hidden (#128)', async ({
    page,
  }) => {
    const name = uniqueName('Veraltet');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    let first = true;
    await page.route('**/api/admin/errors', async (route) => {
      if (!first) return route.continue();
      first = false;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({ status: 400, json: { error: 'Veraltet.' } });
    });
    const outdated = page.waitForResponse(
      (r) => r.url().endsWith('/api/admin/errors') && r.status() === 400,
    );
    await page.getByRole('tab', { name: 'Fehler' }).click();
    const tab = page.locator('#admin-errors');
    await tab.getByLabel('Art').selectOption('report');
    await expect(
      tab.getByRole('group', { name: 'Fehlerseiten' }),
    ).toBeVisible();
    await outdated;
    // Let the page handle the late answer before looking.
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 300)),
    );
    await expect(tab.locator('.notice')).toBeHidden();
    await expect(tab.getByLabel('Art')).toHaveValue('report');
  });

  test('a player without admin rights has no tab „Fehler“', async ({
    page,
  }) => {
    await register(page, uniqueName('Kein'));
    await expect(page.locator('#menu [data-v=admin]')).toHaveCount(0);
    const refused = await page.evaluate(async () => {
      const r = await fetch('/api/admin/errors/download', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      return { status: r.status, type: r.headers.get('content-type') };
    });
    expect(refused.status).toBe(400);
    expect(refused.type).not.toBe('application/zip');
  });

  test('reports, the tab „Fehler“ and the download work on a phone @phone', async ({
    page,
  }) => {
    const name = uniqueName('Handy');
    await register(page, name);
    await nav(page, 'help');
    await sendReport(
      page,
      page.locator('#reportform'),
      'Auf dem Handy klemmt es.',
    );
    await nav(page, 'buildings');
    const dialog = await reportFromToast(page);
    await sendReport(page, dialog, 'Bauen klappt nicht.');

    const tab = await openErrorTab(page, name);
    await expect(
      tab.getByRole('row', { name: /Auf dem Handy klemmt es/ }),
    ).toContainText('Problemmeldung');
    await expect(
      tab.getByRole('row', { name: /Bauen klappt nicht/ }),
    ).toContainText('buildings / toast');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    const files = await downloadZip(page, tab);
    expect(jsonLines(files['reports.jsonl'])).toContainEqual(
      expect.objectContaining({
        player: name,
        text: 'Auf dem Handy klemmt es.',
        action: 'form',
        page: 'help',
      }),
    );
  });
});
