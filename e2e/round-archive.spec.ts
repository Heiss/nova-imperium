// The round archive (#235, okf/features/round-archive.md): while a round runs,
// a player sees it in „Rundenarchiv“ as „Nach Rundenende verfügbar“ and cannot
// open it; the admin closes the round with „Runde abschließen“ (once), and the
// participant opens its report: the ranking with the own row marked „(du)“,
// the column „Spielzeit“ (D2, the play time is shared in the archive after the
// round) and the own place. „Neue Runde“ resets the universe, so this runs on
// the second server of the E2E start, the one of the mail and new-round specs
// (#68); the test starts its own round first, so it does not depend on what
// closed an earlier round. The words of the report are drafts [V] of the
// build; the checks hold the words the okf note names and the structure.
import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  lastToast,
  loginByCode,
  mailCli,
  nav,
  optionsSection,
  registerByMail,
  uniqueName,
  watch,
} from './helpers.ts';

/** The box „Rundenarchiv“ of „Hilfe & Optionen“. */
const archive = (page: Page): Locator =>
  page.locator('.box').filter({
    has: page.locator('.hd', { hasText: 'Rundenarchiv' }),
  });

/** axe (WCAG 2.1 A and AA) on the box of the archive, as in e2e/a11y.spec.ts. */
async function archiveViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .include('.opt')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** The whole flow; on a phone the box is in the section „Runde“ of „Optionen“. */
async function archiveFlow(page: Page, browser: Browser): Promise<void> {
  test.setTimeout(90_000);
  const w = watch(page);
  const boss = uniqueName('Spielleitung');
  const player = uniqueName('Teilnehmer');
  await registerByMail(page, boss);
  mailCli('admin', boss);
  await loginByCode(page, boss);

  // A round of its own: the old one is archived, nothing is shared with
  // another spec, and the participants below are all in it.
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page.getByRole('button', { name: 'Neue Runde starten' }).click();
  await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
  await expect(lastToast(page)).toContainText('Neue Runde gestartet');

  // axe needs a page of its own context.
  const other = await (
    await browser.newContext({ viewport: page.viewportSize() })
  ).newPage();
  const wo = watch(other);
  await registerByMail(other, player);
  await loginByCode(other, player);

  // The running round is no report for a player.
  await nav(other, 'help');
  await optionsSection(other, 'Runde');
  const running = archive(other)
    .locator('tr')
    .filter({ hasText: 'Nach Rundenende verfügbar' });
  await expect(running).toHaveCount(1);
  await expect(
    archive(other).getByRole('button', { name: 'Bericht öffnen' }),
  ).toHaveCount(0);

  // The admin closes it, once.
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Runde abschließen' }).click();
  await expect(lastToast(page)).toContainText('abgeschlossen');
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Runde abschließen' }).click();
  await expect(page.locator('.toast.err').last()).toContainText(
    'Diese Runde ist schon abgeschlossen.',
  );
  const adminRow = page
    .getByRole('row')
    .filter({ has: page.getByRole('button', { name: 'Bericht öffnen' }) })
    .first();
  await expect(adminRow.getByRole('button', { name: 'Löschen' })).toBeVisible();

  // The participant finds the round with its place and opens the report.
  await other.reload();
  await nav(other, 'help');
  await optionsSection(other, 'Runde');
  await expect(running).toHaveCount(0);
  const finished = archive(other)
    .locator('tr')
    .filter({ hasText: /Platz \d+ von \d+ · / });
  await expect(finished).toHaveCount(1);
  await finished.getByRole('button', { name: 'Bericht öffnen' }).click();
  const heading = archive(other).getByRole('heading', {
    name: /^Runde \d+$/,
  });
  await expect(heading).toBeFocused();
  await expect(archive(other)).toContainText('Dein Platz');
  // The report fits the screen and has no axe violations (#235, phone too).
  expect(
    await other.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBeLessThanOrEqual(1);
  expect(await archiveViolations(other)).toEqual([]);

  // The ranking: the own row is marked, the others are not; the play time
  // is a column of the finished round.
  const ranking = archive(other).locator('table.scores').first();
  await expect(
    ranking.getByRole('columnheader', { name: 'Spielzeit' }),
  ).toBeVisible();
  const mine = ranking.locator('tr.me');
  await expect(mine).toHaveCount(1);
  await expect(mine).toContainText(`${player} (du)`);
  await expect(ranking.locator('tr', { hasText: boss })).not.toContainText(
    '(du)',
  );
  await expect(ranking.locator('tr', { hasText: boss })).toHaveCount(1);

  // Back to the list.
  await archive(other)
    .getByRole('button', { name: 'Zurück zum Archiv' })
    .click();
  await expect(finished).toHaveCount(1);
  mailCli('unadmin', boss);
  expect([...w.problems, ...wo.problems]).toEqual([]);
}

test.describe('the round archive (#235)', () => {
  test('the admin closes the running round; a participant sees it locked before and opens the report after', async ({
    page,
    browser,
  }) => {
    await archiveFlow(page, browser);
  });

  test('the admin closes the running round; a participant sees it locked before and opens the report after, on a phone @phone', async ({
    page,
    browser,
  }) => {
    await archiveFlow(page, browser);
  });
});

test.describe('the provisional report of the admin, view H (#235)', () => {
  test('the admin refreshes the preview of the running round and opens a participant and goes back', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const w = watch(page);
    const boss = uniqueName('Spielleitung');
    const first = uniqueName('Teilnehmer');
    const late = uniqueName('Nachzuegler');
    await registerByMail(page, boss);
    mailCli('admin', boss);
    await loginByCode(page, boss);
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page.getByRole('button', { name: 'Neue Runde starten' }).click();
    await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
    await expect(lastToast(page)).toContainText('Neue Runde gestartet');

    const other = await (
      await browser.newContext({ viewport: page.viewportSize() })
    ).newPage();
    const wo = watch(other);
    await registerByMail(other, first);

    // The running round: a provisional report only the admin opens.
    const box = page.locator('.box').filter({
      has: page.locator('.hd', { hasText: 'Rundenberichte' }),
    });
    const running = box.getByRole('row').filter({ hasText: 'VORLÄUFIG' });
    await expect(running).toHaveCount(1);
    await running.getByRole('button', { name: 'Bericht öffnen' }).click();
    const heading = box.getByRole('heading', {
      name: /^Runde \d+ \(vorläufig\)$/,
    });
    await expect(heading).toBeFocused();
    await expect(box.locator('.notice')).toContainText(
      'VORLÄUFIG · nur Spielleitung. Stand ',
    );
    const ranking = box.locator('table.scores').first();
    await expect(ranking.locator('tr', { hasText: first })).toHaveCount(1);
    await expect(ranking.locator('tr', { hasText: late })).toHaveCount(0);

    // The preview does not move unasked: a player who joins now is not in it
    // until the admin asks again (view H: refresh feedback only).
    await registerByMail(other, late);
    const refresh = box.getByRole('button', { name: 'Vorschau aktualisieren' });
    await expect(refresh).toHaveCount(1);
    // The new player changes the state of the admin, and the poll draws the
    // page anew; a click that lands while the button is replaced is lost. Wait
    // for that redraw (the marked button is gone), then click.
    await refresh.evaluate((b) => {
      b.dataset.mark = 'old';
    });
    await expect(box.locator('[data-act=roundRefresh][data-mark]')).toHaveCount(
      0,
      { timeout: 15000 },
    );
    await refresh.click();
    await expect(ranking.locator('tr', { hasText: late })).toHaveCount(1);
    await expect(lastToast(page)).toContainText('Vorschau aktualisiert.');
    await expect(heading).toBeVisible();

    // The drilldown of one row, in full, and back to the report.
    const row = ranking.locator('tr', { hasText: first });
    await row.getByRole('button', { name: 'Einblick' }).click();
    const who = box.getByRole('heading', {
      name: new RegExp(`^Runde \\d+ · ${first} \\(vorläufig\\)$`),
    });
    await expect(who).toBeFocused();
    await expect(
      box.getByRole('heading', { name: 'Planeten und Monde' }),
    ).toBeVisible();
    await expect(box.locator('table.kv')).toContainText('Forschungsstufen');
    await expect(box.locator('table.kv')).toContainText('Urlaubsmodus');
    await expect(box.locator('table.kv')).toContainText(
      'wird erst nach Rundenende im Archiv geteilt',
    );
    await expect(box.locator('table.scores')).toContainText('Planet ');
    await box.getByRole('button', { name: 'Zurück zum Bericht' }).click();
    await expect(heading).toBeFocused();
    await expect(ranking.locator('tr', { hasText: first })).toHaveCount(1);
    await box.getByRole('button', { name: 'Zurück zum Archiv' }).click();
    await expect(running).toHaveCount(1);
    mailCli('unadmin', boss);
    expect([...w.problems, ...wo.problems]).toEqual([]);
  });
});
