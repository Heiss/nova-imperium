// The estimated active play time (#231, #232, okf/features/own-activity.md):
// the page reports its active time after an interaction, and the box „Meine
// Aktivität & Spielzeit“ in „Hilfe & Optionen“ shows the sums and „Erfasst
// seit“. A player sees his own numbers only: the account is the session's, and
// the admin's reading of a player is refused for everyone else. The unit tests
// cover the tracker and the judging of the reports; this runs the real page
// against the server. The page counts a stretch of activity when it ends, so
// the test ends it as a browser does when the player leaves the tab: the page
// becomes hidden (the state and the event of the browser, set by the test),
// and the page reports its active time up to then.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { nav, register, uniqueName, watch } from './helpers.ts';

/** The box of the play time in „Hilfe & Optionen“. */
const box = (page: Page): Locator =>
  page.locator('.box').filter({
    has: page.locator('.hd', { hasText: 'Meine Aktivität & Spielzeit' }),
  });

/** The value of a row of the first table of the box, by its label. */
const sum = (page: Page, label: string): Locator =>
  box(page)
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: label, exact: true }) })
    .locator('td')
    .nth(1);

/** The tab is left: the page is hidden, as a browser does it, and says so. */
async function hide(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test.describe('the play time (#231, #232)', () => {
  test('after an interaction the box shows the play time and since when it records', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Spielzeit');
    await register(page, name);
    // The interaction: a click on the page makes it active.
    await nav(page, 'help');
    await expect(sum(page, 'Heute (UTC)')).toBeVisible();
    await page.getByRole('button', { name: 'Aktualisieren' }).click();
    await hide(page);

    // The report of the hidden page credits the stretch; the box asks again.
    await expect(async () => {
      await page.getByRole('button', { name: 'Aktualisieren' }).click();
      await expect(sum(page, 'Heute (UTC)')).toHaveText('unter 1 Min.', {
        timeout: 1000,
      });
    }).toPass({ timeout: 15000 });
    await expect(sum(page, 'Letzte 7 Tage (UTC)')).toHaveText('unter 1 Min.');
    await expect(sum(page, 'Diese Runde')).toHaveText('unter 1 Min.');
    await expect(sum(page, 'Zuletzt aktiv')).toHaveText(
      /^\d\d\.\d\d\.\d{4}, \d\d:\d\d UTC$/,
    );
    await expect(box(page)).toContainText(
      /Erfasst seit \d\d\.\d\d\.\d{4}, \d\d:\d\d UTC\./,
    );
    // The row of today in the table of the days.
    await expect(
      box(page)
        .locator('tr')
        .filter({
          has: page.getByRole('cell', { name: 'Heute', exact: true }),
        }),
    ).toContainText('unter 1 Min.');
    expect(w.problems).toEqual([]);
  });

  test('a player sees his own numbers only', async ({ page, browser }) => {
    const w = watch(page);
    const first = uniqueName('SpielerEins');
    const second = uniqueName('SpielerZwei');
    await register(page, first);
    await nav(page, 'help');
    await expect(sum(page, 'Heute (UTC)')).toBeVisible();
    await hide(page);
    await expect(async () => {
      await page.getByRole('button', { name: 'Aktualisieren' }).click();
      await expect(sum(page, 'Heute (UTC)')).toHaveText('unter 1 Min.', {
        timeout: 1000,
      });
    }).toPass({ timeout: 15000 });

    // The second player has played none of it.
    const other = await browser.newPage({ viewport: page.viewportSize() });
    const wo = watch(other);
    await register(other, second);
    await nav(other, 'help');
    await expect(sum(other, 'Heute (UTC)')).toHaveText('0 Min.');
    await expect(sum(other, 'Alle Runden')).toHaveText('0 Min.');

    // The account is the session's: a request names no other player, and what
    // the admin reads of a player is refused to a player.
    const answers = await other.evaluate(async () => {
      const own = await fetch('/api/own-activity?user=other&player=other');
      const admin = await fetch('/api/admin/stats', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      return {
        own: (await own.json()) as { totalMs: number },
        adminStatus: admin.status,
      };
    });
    expect(answers.own.totalMs).toBe(0);
    expect(answers.adminStatus).toBe(400);
    expect([...w.problems, ...wo.problems]).toEqual([]);
  });
});
