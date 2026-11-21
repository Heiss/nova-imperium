// What the player typed or chose in a form is still there after the poll of
// the state drew the view anew (#118, package 8: the drafts of
// src/client/logic/field-drafts.ts replace the restore of the redraw). The
// client draws the view anew only when the state it polls (every 4 s)
// differs from the last one, so each test changes the state of its own
// player and waits until the node of a field it marked is replaced.
import { expect, test, type Page } from '@playwright/test';
import {
  cli,
  guildTag,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

async function waitForRedraw(
  page: Page,
  id: string,
  change: () => void,
): Promise<void> {
  await waitForReplaced(page, `#${id}`, change);
}

/** Marks the node of `selector`, runs `change` and waits until the poll drew it anew. */
async function waitForReplaced(
  page: Page,
  selector: string,
  change: () => void,
): Promise<void> {
  await page.evaluate((sel) => {
    document.querySelector<HTMLElement>(sel)!.dataset.mark = 'old';
  }, selector);
  change();
  await expect(page.locator(`${selector}[data-mark]`)).toHaveCount(0, {
    timeout: 15000,
  });
}

test.describe('a redraw by the poll keeps the draft of a form', () => {
  test('the fleet form keeps the position, the count and the chosen mission', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfFlotte');
    await register(page, name);
    seed({
      name,
      ships: { probe: 3 },
      research: { carto: 5 },
      res: { m: 0, c: 0, d: 10000 },
    });
    await page.goto('/?view=fleet');
    await page.getByLabel('Position', { exact: true }).fill('2');
    await page.getByLabel('Anzahl Spähschädel').fill('2');
    const mission = page.getByLabel('Auftrag');
    await mission.selectOption('survey');

    await waitForRedraw(page, 't_m', () =>
      seed({ name, res: { m: 0, c: 0, d: 10001 } }),
    );
    await expect(page.getByLabel('Position', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('Anzahl Spähschädel')).toHaveValue('2');
    await expect(mission).toHaveValue('survey');
    expect(w.problems).toEqual([]);
  });

  test('the marketplace keeps the amount and the chosen resources', async ({
    page,
  }) => {
    const w = watch(page);
    const player = uniqueName('EntwurfMarkt');
    await register(page, player);
    seed({
      name: player,
      b: { market: 1, robot: 4 },
      res: { m: 5000, c: 100, d: 0 },
      marketReset: true,
    });
    await page.reload();
    await nav(page, 'market');
    const give = page.locator('#market-give');
    await give.selectOption({ index: 1 });
    const chosen = await give.inputValue();
    await page.locator('#market-amount').fill('123');

    await waitForRedraw(page, 'market-amount', () =>
      seed({ name: player, res: { m: 5001, c: 100, d: 0 } }),
    );
    await expect(page.locator('#market-amount')).toHaveValue('123');
    await expect(page.locator('#market-give')).toHaveValue(chosen);
    expect(w.problems).toEqual([]);
  });

  test('the form of a new guild keeps what was typed', async ({ page }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfGilde');
    await register(page, name);
    await nav(page, 'guilds');
    const tag = guildTag('E');
    await page.locator('#guild_tag').fill(tag);
    await page.locator('#guild_name').fill('Halbfertige Gilde');
    await page.locator('#guild_description').fill('Noch nicht fertig');

    await waitForRedraw(page, 'guild_tag', () =>
      seed({ name, res: { m: 0, c: 0, d: 10002 } }),
    );
    await expect(page.locator('#guild_tag')).toHaveValue(tag);
    await expect(page.locator('#guild_name')).toHaveValue('Halbfertige Gilde');
    await expect(page.locator('#guild_description')).toHaveValue(
      'Noch nicht fertig',
    );
    expect(w.problems).toEqual([]);
  });
  test('the position of the Sternenkarte keeps what was typed until Enter', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfKarte');
    await register(page, name);
    await page.goto('/?view=galaxy');
    const gal = page.getByLabel('Galaxie', { exact: true });
    const sys = page.getByLabel('System', { exact: true });
    await expect(gal).toHaveValue(/^\d+$/);
    await gal.fill('1');
    await sys.fill('1');

    await waitForRedraw(page, 'g_g', () =>
      seed({ name, res: { m: 0, c: 0, d: 10003 } }),
    );
    await expect(gal).toHaveValue('1');
    await expect(sys).toHaveValue('1');
    await sys.press('Enter');
    await expect(sys).toHaveValue('1');
    expect(w.problems).toEqual([]);
  });
  test('the opened details of the event log stay open with their code over a redraw', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfLog');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    const events = page.locator('[data-admin=events]');
    await expect(events.getByRole('status')).toHaveText(/ Ereignisse$/);
    const row = events
      .getByRole('row')
      .filter({ hasText: name })
      .filter({ hasText: 'account / register' });
    await row.locator('summary').click();
    await expect(row.locator('details')).toHaveAttribute('open', '');
    const code = row.locator('details > code');
    await expect(code).toContainText('{');

    await waitForRedraw(page, 'admin-tab-events', () =>
      seed({ name, res: { m: 0, c: 0, d: 10004 } }),
    );
    await expect(row.locator('details')).toHaveAttribute('open', '');
    JSON.parse(await code.innerText());
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });

  test('the opened details of the error log stay open over a redraw', async ({
    page,
  }) => {
    // No watch(page): the failed build is a 500 the browser logs on purpose.
    const name = uniqueName('EntwurfFehler');
    await register(page, name);
    const request = '1a2b3c4d-1c3d-4e5f-8a9b-0c1d2e3f4a5b';
    await page.route(
      '**/api/action',
      (route) =>
        route.fulfill({
          status: 500,
          headers: { 'x-request-id': request },
          json: { error: 'Serverfehler.' },
        }),
      { times: 1 },
    );
    const reported = page.waitForResponse('**/api/errors');
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=metal]');
    expect((await reported).status()).toBe(200);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Fehler' }).click();
    const tab = page.locator('#admin-errors');
    const row = tab.getByRole('row', { name: /HTTP 500: \/api\/action/ });
    await row
      .first()
      .getByText(/^Eintrag \d+$/)
      .click();
    await expect(row.first().locator('details')).toHaveAttribute('open', '');
    await expect(row.first()).toContainText(`Vorgang ${request}`);

    await waitForRedraw(page, 'admin-tab-errors', () =>
      seed({ name, res: { m: 0, c: 0, d: 10005 } }),
    );
    await expect(row.first().locator('details')).toHaveAttribute('open', '');
    await expect(row.first()).toContainText(`Vorgang ${request}`);
    cli('unadmin', name);
  });

  test('what the admin chose and typed in the filter of the event log stays over a redraw', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfFilter');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    const events = page.locator('[data-admin=events]');
    await expect(events.getByRole('status')).toHaveText(/ Ereignisse$/);
    const filter = page.locator('#diagnostics-filter');
    const player = filter.getByLabel('Spieler', { exact: true });
    const outcome = filter.getByLabel('Ergebnis');
    const action = filter.getByLabel('Aktion');
    const since = filter.getByLabel('Von');
    await player.selectOption({ label: name });
    await outcome.selectOption({ label: 'Abgelehnt' });
    await action.fill('build');
    await since.fill('2026-11-01');

    await waitForRedraw(page, 'audit-outcome', () =>
      seed({ name, res: { m: 0, c: 0, d: 10006 } }),
    );
    await expect(player.locator('option:checked')).toHaveText(name);
    await expect(outcome.locator('option:checked')).toHaveText('Abgelehnt');
    await expect(action).toHaveValue('build');
    await expect(since).toHaveValue('2026-11-01');
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });

  test('what the admin chose in the filter of the error log stays over a redraw', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfFehlerFilter');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Fehler' }).click();
    const tab = page.locator('#admin-errors');
    const kind = tab.getByLabel('Art');
    const size = tab.getByLabel('Anzahl je Seite');
    const since = tab.getByLabel('Zeitraum von');
    // A choice asks the server at once; wait for that answer, so the redraw
    // below is the one of the poll.
    const answered = page.waitForResponse('**/api/admin/errors');
    await kind.selectOption({ label: 'Problemmeldungen' });
    await answered;
    const resized = page.waitForResponse('**/api/admin/errors');
    await size.selectOption('50');
    await resized;
    await since.fill('2026-11-01');

    await waitForReplaced(page, '#errors-filter select[name=kind]', () =>
      seed({ name, res: { m: 0, c: 0, d: 10007 } }),
    );
    await expect(kind.locator('option:checked')).toHaveText('Problemmeldungen');
    await expect(size).toHaveValue('50');
    await expect(since).toHaveValue('2026-11-01');
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });
});
