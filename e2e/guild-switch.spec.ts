// Guilds (with chat) on or off per round (#191): the admin starts a round
// with guilds off in the dialog „Neue Runde“; the guilds are gone, nobody
// sees „Gilden“, and the server refuses every guild action. The next round
// with guilds on brings them back without the old guild. The push kinds of
// the guild chat are hidden in the options while guilds are off (#169,
// owner, 2026-11-15). Desktop and phone.
// On the mail server (#68): its own universe, so the new rounds reset no
// planet of the other tests (every test registers its own players there, so
// a round that ran earlier resets only finished ones). The dialog also shows the lock of the main
// planet (#221).
import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  guildTag,
  loginByCode,
  mailCli,
  nav,
  registerByMail,
  uniqueName,
  watch,
  withWebPush,
} from './helpers.ts';
import { E2E_MAIL_URL } from './env.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const OFF = 'Gilden sind in dieser Runde abgeschaltet.';
const BOX = 'Gilden (mit Chat)';
const WARNING =
  'Eine neue Runde leert alle Gilden-Chats. Ohne Gilden werden alle Gilden mit Mitgliedern, Bewerbungen, Rängen und Chat gelöscht.';
/** The push kinds of the guild chat (#192, #169). */
const GUILD_PUSH = ['Gildenereignisse', 'Nachrichten im Gilden-Chat'];

const lastToast = (page: Page): Locator => page.locator('.toast').last();
/** The menu entry „Gilden“: the side menu on a desktop, „Mehr“ on a phone. */
const guildEntry = (page: Page): Locator =>
  page.locator('#menu [data-v=guilds], #more-list [data-v=guilds]');

async function violations(page: Page, label: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) => `${label}: ${v.id} (${v.impact}): ${v.help}`,
  );
}

/** A guild action as from a device that still shows the guild view. */
const refusal = (page: Page, data: object): Promise<string | undefined> =>
  page.evaluate(async (body) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return ((await r.json()) as { error?: string }).error;
  }, data);

/** What the server sends a player about guilds. */
const guildData = (page: Page): Promise<unknown> =>
  page.evaluate(async () => {
    const r = await fetch('/api/state');
    return ((await r.json()) as { guilds?: unknown }).guilds;
  });

async function openRoundDialog(page: Page): Promise<Locator> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page.getByRole('button', { name: 'Neue Runde starten' }).click();
  await expect(
    page.getByText('Wirklich eine neue Runde starten?'),
  ).toBeVisible();
  // The warning stands below the box, whatever the box shows (owner,
  // 2026-11-14), and the box names it as its description.
  const box = page.getByLabel(BOX);
  await expect(page.getByText(WARNING)).toBeVisible();
  await expect(box).toHaveAccessibleDescription(WARNING);
  // The lock of the main planet (#221): 7 days, as no round changed it.
  await expect(
    page.getByLabel('Sperre nach einem Wechsel des Hauptplaneten (Tage)'),
  ).toHaveValue('7');
  return box;
}

const LED = {
  box: 'Leitest du eine Gilde, wird sie aufgelöst.',
  dialog: 'Eine von dir geleitete Gilde wird aufgelöst.',
};

/**
 * „Account löschen“ in the options and its dialog: the sentence about a led
 * guild only in a round with guilds (owner, 2026-11-14). Only looked at.
 */
async function accountDeletion(
  page: Page,
  guilds: boolean,
  found: string[],
): Promise<void> {
  const count = guilds ? 1 : 0;
  await nav(page, 'help');
  await expect(
    page.getByText(
      'Dein Konto und deine Spielstände werden dauerhaft gelöscht.',
    ),
  ).toBeVisible();
  await expect(page.getByText(LED.box)).toHaveCount(count);
  // The push kinds of the guild chat only in a round with guilds; the
  // other kinds stay (owner, 2026-11-15).
  await expect(page.getByLabel('Neue Version')).toBeVisible();
  for (const kind of GUILD_PUSH)
    await expect(page.getByLabel(kind, { exact: true })).toHaveCount(count);
  if (!guilds)
    found.push(...(await violations(page, 'options without guilds')));
  await page
    .getByRole('button', { name: 'Account löschen', exact: true })
    .click();
  await expect(
    page.getByText(
      'Dein Konto und deine Spielstände werden unwiderruflich gelöscht.',
    ),
  ).toBeVisible();
  await expect(page.getByText(LED.dialog)).toHaveCount(count);
  if (!guilds)
    found.push(...(await violations(page, 'deletion dialog without guilds')));
  await page.getByRole('button', { name: 'Abbrechen' }).click();
}

async function startRound(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
  await expect(lastToast(page)).toContainText(
    'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.',
  );
}

async function switchFlow(page: Page, browser: Browser): Promise<void> {
  const admin = uniqueName('Schalter');
  const member = uniqueName('Gildner');
  const tag = guildTag('S');
  const title = `[${tag}] Schalter ${tag}`;
  const problems = [watch(page)];
  const found: string[] = [];
  await registerByMail(page, admin);
  mailCli('admin', admin);
  await loginByCode(page, admin);

  // A round with guilds on, as today: a guild with a member.
  await nav(page, 'guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(`Schalter ${tag}`);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  // A context of its own: axe runs only on a page of browser.newContext().
  const memberContext = await browser.newContext();
  const pm = await memberContext.newPage();
  // The options show the push kinds only on a server with Web Push.
  await withWebPush(pm);
  problems.push(watch(pm));
  await registerByMail(pm, member);
  await loginByCode(pm, member);
  await nav(pm, 'guilds');
  await pm.getByRole('link', { name: title }).click();
  await pm.getByRole('button', { name: 'Bewerben' }).click();
  await expect(lastToast(pm)).toContainText('Bewerbung gesendet.');
  await page.reload();
  await page.getByRole('button', { name: 'Annehmen' }).click();
  await expect(lastToast(page)).toContainText('Bewerbung angenommen.');

  await accountDeletion(pm, true, found);

  // The dialog „Neue Runde“ shows the current setting: on.
  const box = await openRoundDialog(page);
  await expect(box).toBeChecked();
  found.push(...(await violations(page, 'dialog')));
  await box.uncheck();
  await startRound(page);

  // The guilds are gone, nobody sees „Gilden“, the server refuses.
  const another = guildTag('N');
  for (const p of [page, pm]) {
    await p.goto(`${E2E_MAIL_URL}/?view=guilds`);
    await expect(p.locator('h2')).toContainText('Übersicht');
    await expect(guildEntry(p)).toHaveCount(0);
    expect(await guildData(p)).toBeNull();
    expect(
      await refusal(p, {
        type: 'createGuild',
        name: `Neu ${another}`,
        tag: another,
      }),
    ).toBe(OFF);
    expect(await refusal(p, { type: 'leaveGuild' })).toBe(OFF);
  }
  expect(await refusal(page, { type: 'dissolveGuild', tag })).toBe(OFF);
  found.push(...(await violations(page, 'overview without guilds')));
  await accountDeletion(pm, false, found);

  // The next dialog shows the current setting: off. On again brings guilds
  // back, without the old guild.
  const again = await openRoundDialog(page);
  await expect(again).not.toBeChecked();
  found.push(...(await violations(page, 'dialog without guilds')));
  await again.check();
  await startRound(page);
  await expect(guildEntry(page).first()).toBeAttached();
  await nav(page, 'guilds');
  await expect(page.getByRole('link', { name: title })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Gilde gründen' }),
  ).toBeVisible();
  await pm.reload();
  await expect(guildEntry(pm).first()).toBeAttached();
  await accountDeletion(pm, true, found);
  await memberContext.close();
  mailCli('unadmin', admin);
  expect(found).toEqual([]);
  expect(problems.flatMap((w) => w.problems)).toEqual([]);
}

test.describe('guilds on or off per round (#191)', () => {
  test('the admin starts a round without guilds: gone, hidden and refused', async ({
    page,
    browser,
  }) => {
    await switchFlow(page, browser);
  });

  test('the admin starts a round without guilds: gone, hidden and refused, on a phone @phone', async ({
    page,
    browser,
  }) => {
    await switchFlow(page, browser);
  });
});
