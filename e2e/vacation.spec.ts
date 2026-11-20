// The vacation mode (#223, okf/features/vacation-mode.md): a player starts
// it in the options („Urlaubsmodus aktivieren“, after a question) and sees
// the lock screen instead of the game (owner, 2026-11-18): the notice, the
// button „Urlaubsmodus beenden“ greyed out with the time left in text, the
// sign-out and the account options. The server refuses every action but
// the end and an early end. Another player sees „(u)“ on the Sternenkarte
// and the server refuses an attack. After the minimum duration the button
// turns on by itself and ends it. Desktop and phone, with axe on the
// options and on the lock screen.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  galaxyAction,
  galaxyRow,
  nav,
  optionsSection,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const DATE = String.raw`\d\d\.\d\d\.\d{4}, \d\d:\d\d`;
const HOUR = 3_600_000;

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const lastToast = (page: Page): Locator => page.locator('.toast').last();

/** An action as from a device that still shows an older page. */
const refusal = (page: Page, data: object): Promise<string | undefined> =>
  page.evaluate(async (body) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return ((await r.json()) as { error?: string }).error;
  }, data);

const startButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'Urlaubsmodus aktivieren' });
const endButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'Urlaubsmodus beenden' });

/** The away player starts the vacation mode in the options. */
async function startVacation(page: Page): Promise<void> {
  await nav(page, 'help');
  await optionsSection(page, 'Runde');
  await expect(
    page.getByText(
      'Aktivieren kannst du ihn nur, wenn keine eigenen Flotten unterwegs sind und weder gebaut, geforscht noch in der Schiffsschmiede gearbeitet wird.',
    ),
  ).toBeVisible();
  expect(await violations(page)).toEqual([]);
  page.once('dialog', (d) => {
    expect(d.message()).toBe(
      'Urlaubsmodus aktivieren? Beenden kannst du ihn frühestens nach 48 Stunden.',
    );
    void d.accept();
  });
  await startButton(page).click();
  await expect(lastToast(page)).toContainText('Urlaubsmodus aktiviert.');
  await expectLocked(page);
  expect(await violations(page)).toEqual([]);
  // The server refuses everything but the end, and the end before its time.
  for (const type of ['build', 'read', 'options', 'sendGuildChat'])
    expect(await refusal(page, { type }), type).toBe(
      'Im Urlaubsmodus nicht möglich.',
    );
  expect(await refusal(page, { type: 'endVacation' })).toMatch(
    new RegExp(`^Der Urlaubsmodus ist frühestens beendbar am ${DATE}\\.$`),
  );
  // The lock holds after a reload, and nothing of the game shows.
  await page.reload();
  await expectLocked(page);
}

/** The lock screen: the notice, the greyed-out button with its reason, the account, no game. */
async function expectLocked(page: Page): Promise<void> {
  await expect(page.locator('h2')).toHaveText('Urlaubsmodus');
  await expect(page.getByText('Dein Konto ist im Urlaubsmodus.')).toBeVisible();
  await expect(page.locator('#lock-note')).toHaveText(
    /^Du kannst den Urlaubsmodus in .+ beenden\.$/,
  );
  await expect(endButton(page)).toBeDisabled();
  await expect(endButton(page)).toHaveAccessibleDescription(
    /^Du kannst den Urlaubsmodus in .+ beenden\.$/,
  );
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByLabel('Bisheriges Passwort')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Account löschen' }),
  ).toBeVisible();
  await expect(page.locator('#menu')).toBeEmpty();
  await expect(page.locator('#resbar')).toBeEmpty();
  await expect(startButton(page)).toHaveCount(0);
}

/** Another player sees the mark and cannot attack. */
async function visit(page: Page, away: string): Promise<void> {
  const visitor = uniqueName('Besuch');
  await register(page, visitor);
  seed({ name: visitor, ships: { lf: 5 }, res: { m: 0, c: 0, d: 10000 } });
  // Mines give the away player points enough against the noob protection.
  seed({ name: away, b: { metal: 12, crystal: 10 } });
  await nav(page, 'highscore');
  await page
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: away, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  const row = galaxyRow(page, away);
  await expect(row.getByTitle('Urlaubsmodus')).toHaveText('(u)');
  await (await galaxyAction(page, row, 'Sturmangriff')).click();
  await page.getByLabel('Anzahl Abfangjäger').fill('1');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText(
    'Dieser Spieler ist im Urlaubsmodus.',
  );
}

async function vacationFlow(page: Page): Promise<void> {
  const { problems } = watch(page);
  const away = uniqueName('Urlaub');
  await register(page, away);
  await startVacation(page);
  await page.context().clearCookies();
  await visit(page, away);
  await page.context().clearCookies();

  // A login shows the lock screen; its button turns on by itself at the end.
  await page.goto('/');
  await page.fill('#a_name', away);
  await page.fill('#a_pw', 'ein-sicheres-testpasswort');
  await page.click('button[type=submit]');
  await expectLocked(page);
  seed({ name: away, vacationAgo: 48 * HOUR - 3000 });
  await page.reload();
  await expectLocked(page);
  await expect(endButton(page)).toBeEnabled({ timeout: 15_000 });
  await expect(page.locator('#lock-note')).toHaveCount(0);
  expect(await violations(page)).toEqual([]);
  // After a reload past the end the button is on from the start.
  seed({ name: away, vacationAgo: 49 * HOUR });
  await page.reload();
  await expect(endButton(page)).toBeEnabled();
  await expect(page.locator('#lock-note')).toHaveCount(0);
  await endButton(page).click();
  await expect(lastToast(page)).toContainText('Urlaubsmodus beendet.');
  await expect(page.locator('h2')).toContainText('Übersicht');
  await nav(page, 'help');
  await optionsSection(page, 'Runde');
  await expect(startButton(page)).toBeVisible();
  expect(problems).toEqual([]);
}

test('the vacation mode starts in the options, protects the player and ends after the minimum duration', async ({
  page,
}) => {
  await vacationFlow(page);
});

test('the vacation mode on a phone @phone', async ({ page }) => {
  await vacationFlow(page);
});
