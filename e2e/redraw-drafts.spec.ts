// What the player typed or chose in a form is still there after the poll of
// the state drew the view anew (#118, package 8; #332: each form keeps its
// fields as the state of its component, src/client/logic/form-state.svelte.ts,
// and nothing restores them). The client draws the view anew only when the
// state it polls (every 4 s) differs from the last one, so each test changes
// the state of its own player and waits until the poll drew it: a new colony
// in the header's choice of the planet (`pollRender` of helpers.ts, #361; the
// views with fields keep their nodes over such a render, so a replaced node
// tells nothing any more; the lists wait for the answers of the poll).
import { expect, test } from '@playwright/test';
import {
  cli,
  guildTag,
  nav,
  openAllRows,
  pollRender,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

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

    await pollRender(page, name);
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

    await pollRender(page, player);
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

    await pollRender(page, name);
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

    // The Sternenkarte is kept by a render that is not fresh (#352), so its
    // fields are not replaced: the poll render is told by what the new state
    // brings into the map itself, a colony on slot 15 of the shown system.
    const colony = uniqueName('Entwurfskolonie');
    seed({ name, colony: { name: colony } });
    await expect(page.locator('table.gal')).toContainText(colony, {
      timeout: 15000,
    });
    await expect(gal).toHaveValue('1');
    await expect(sys).toHaveValue('1');
    await sys.press('Enter');
    await expect(sys).toHaveValue('1');
    expect(w.problems).toEqual([]);
  });
  test('the filter of the achievements keeps the search, the category and the status', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfErfolge');
    await register(page, name);
    await nav(page, 'achievements');
    await page.locator('#achievement_search').fill('flotte');
    await page.locator('#achievement_category').selectOption('fleet');
    await page.locator('#achievement_status').selectOption('open');

    await pollRender(page, name);
    await expect(page.locator('#achievement_search')).toHaveValue('flotte');
    await expect(page.locator('#achievement_category')).toHaveValue('fleet');
    await expect(page.locator('#achievement_status')).toHaveValue('open');
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

    await pollRender(page, name);
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

    await pollRender(page, name);
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

    await pollRender(page, name);
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

    await pollRender(page, name);
    await expect(kind.locator('option:checked')).toHaveText('Problemmeldungen');
    await expect(size).toHaveValue('50');
    await expect(since).toHaveValue('2026-11-01');
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });

  // The lists are mounted once and follow the state, so their fields are not
  // drawn anew (src/client/views/list-fields.test.ts); no draft restores them.
  test('the amounts of the lists stay in their fields over a redraw', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfListen');
    await register(page, name);
    seed({
      name,
      res: { m: 1000, c: 1000, d: 1000 },
      b: { yard: 1, silo: 2 },
      def: { abm: 4 },
    });
    await page.reload();
    await nav(page, 'defense');
    await openAllRows(page);
    await page.locator('#q_abm').fill('2');
    await page.locator('#td_abm').fill('3');

    // Two answers of the state after the change: the second one surely
    // draws the view with it (the poll runs every 4 s).
    const answered = () =>
      page.waitForResponse(
        (r) => new URL(r.url()).pathname === '/api/state' && r.ok(),
      );
    seed({ name, res: { m: 1000, c: 1000, d: 1001 } });
    await answered();
    await answered();
    await expect(page.locator('#q_abm')).toHaveValue('2');
    await expect(page.locator('#td_abm')).toHaveValue('3');
    expect(w.problems).toEqual([]);
  });
});
