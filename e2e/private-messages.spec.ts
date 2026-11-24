// Private messages (#226, owner, 2026-11-21): two players write to each other
// in „Nachrichten“ (the tabs „Berichte“, „Posteingang“, „Gesendet“), the
// unread mark of the menu comes and goes, text is shown as text, a message is
// deleted from the own view only, the refusals (oneself, an unknown name, the
// limits of text and rate), the block list and „nur Freunde“ refuse with the
// one neutral text, a recipient reports a message and the admin sees only
// that one in „Gemeldete Nachrichten“. The inbox shows a preview per
// conversation; a conversation loads when it is opened, „Gesendet“ when its
// tab is opened, older messages by „Ältere Nachrichten laden“, and a new
// message comes into the open conversation with the next refresh (Q32, Q33).
// Desktop and phone, with axe on the inbox. The rate limit is one message per sender every 2 s, so a test waits
// on the clock (`rested`) before a sender writes again.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { cli, lastToast, nav, register, uniqueName, watch } from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const REFUSED = 'Dieser Spieler nimmt keine Nachrichten von dir an.';
const GAP_MS = 2100;

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** When each page last sent a message, for the limit of one every 2 s. */
const sentAt = new WeakMap<Page, number>();

/** Waits on the clock until the sender may write again; no wait for a state of the page. */
async function rested(page: Page): Promise<void> {
  const last = sentAt.get(page) ?? 0;
  await expect.poll(() => Date.now() - last).toBeGreaterThan(GAP_MS);
}

/** Opens „Nachrichten“ and one of its tabs. */
async function openTab(page: Page, tab: string): Promise<void> {
  await nav(page, 'messages');
  await page.getByRole('tab', { name: tab }).click();
}

/**
 * Writes in the dialog „Neue Nachricht“ of „Posteingang“ (#349): opens it
 * unless it is still open from a refused message.
 */
async function compose(page: Page, to: string, text: string): Promise<void> {
  await rested(page);
  const form = page.locator('#pm-compose');
  if (!(await form.isVisible())) {
    await openTab(page, 'Posteingang');
    await page.getByRole('button', { name: 'Neue Nachricht' }).click();
  }
  await page.locator('#pm-to').fill(to);
  await page.locator('#pm-text').fill(text);
  await form.getByRole('button', { name: 'Senden', exact: true }).click();
  sentAt.set(page, Date.now());
}

/** A refusal of a message: inside the dialog „Neue Nachricht“, with the server's words (#349). */
const refusalIn = (page: Page): Locator =>
  page.locator('#pm-compose').getByRole('alert');

/** Opens the dialog „Antworten“ below the open conversation (#349). */
async function openReply(page: Page): Promise<void> {
  await thread(page).getByRole('button', { name: 'Antworten' }).click();
  await expect(page.locator('#pm-reply')).toBeVisible();
}

/** Replies in the open conversation through the dialog „Antworten“. */
async function reply(page: Page, text: string): Promise<void> {
  await rested(page);
  await openReply(page);
  await page.locator('#pm-reply-text').fill(text);
  await page
    .locator('#pm-reply')
    .getByRole('button', { name: 'Antworten', exact: true })
    .click();
  sentAt.set(page, Date.now());
}

/** An action as from a page that still shows an old list; the answer is the error, if any. */
const refusal = (page: Page, body: object): Promise<string | undefined> =>
  page.evaluate(async (data) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    return ((await r.json()) as { error?: string }).error;
  }, body);

/** The open conversation. */
const thread = (page: Page): Locator => page.locator('#pm-thread');

/** The label of the tab „Posteingang“ with its number of unread messages. */
const inboxTab = (page: Page): Locator =>
  page.getByRole('tab', { name: /^Posteingang/ });

/** Opens the conversation with `name` in „Posteingang“. */
async function openConversation(page: Page, name: string): Promise<void> {
  await openTab(page, 'Posteingang');
  await page
    .locator('.pm-list')
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .click();
  await expect(thread(page).getByRole('heading', { name })).toBeVisible();
}

async function newPlayers(
  page: Page,
  browser: import('@playwright/test').Browser,
) {
  const anna = uniqueName('Absenderin');
  const bert = uniqueName('Empfaenger');
  await register(page, anna);
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  const other = await context.newPage();
  await register(other, bert);
  return { anna, bert, other, context };
}

async function exchangeFlow(
  page: Page,
  browser: import('@playwright/test').Browser,
): Promise<void> {
  const { problems } = watch(page);
  const { anna, bert, other, context } = await newPlayers(page, browser);
  const otherProblems = watch(other).problems;

  // „Nachrichten“ has the three tabs; the reports are the first.
  await nav(page, 'messages');
  await expect(page.getByRole('tab')).toHaveText([
    'Berichte',
    'Posteingang',
    'Gesendet',
  ]);
  await expect(page.getByRole('tab', { name: 'Berichte' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await openTab(page, 'Posteingang');
  await expect(
    page
      .getByRole('tabpanel', { name: 'Posteingang' })
      .getByText('Keine Nachrichten.'),
  ).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // Anna writes; markup in the text is shown as text.
  const first = '<b>Hallo</b> Bert & Co';
  await compose(page, bert, first);
  await expect(thread(page)).toContainText(first);
  await expect(thread(page).locator('b', { hasText: 'Hallo' })).toHaveCount(0);
  await expect(page.locator('#pm-text')).toHaveCount(0);
  await openTab(page, 'Gesendet');
  await expect(page.locator('#messages-panel-sent')).toContainText(bert);
  await expect(page.locator('#messages-panel-sent')).toContainText(first);
  // The inbox shows the newest message as the preview of the conversation.
  await page.getByRole('tab', { name: /^Posteingang/ }).click();
  await expect(page.locator('.pm-list')).toContainText(first);

  // Bert gets the mark of the menu and the number on the tab, reads the
  // conversation, and the number goes.
  await other.reload();
  await nav(other, 'messages');
  await expect(inboxTab(other)).toHaveText('Posteingang (1)');
  await other.getByRole('tab', { name: /^Posteingang/ }).click();
  await other
    .locator('.pm-list')
    .getByRole('button', { name: new RegExp(`^${anna}`) })
    .click();
  await expect(thread(other)).toContainText(first);
  await expect(thread(other).getByText('neu')).toBeVisible();
  await expect(inboxTab(other)).toHaveText('Posteingang');
  expect(await violations(other)).toEqual([]);

  // Bert replies; Anna sees it with the number on the tab. The sent reply
  // leaves no draft: the dialog opens again with an empty text (#349).
  await reply(other, 'Antwort von Bert');
  await expect(thread(other)).toContainText('Antwort von Bert');
  await expect(other.locator('#pm-reply')).toBeHidden();
  await openReply(other);
  await expect(other.locator('#pm-reply-text')).toHaveValue('');
  await other.getByRole('button', { name: 'Abbrechen' }).click();
  await page.reload();
  await nav(page, 'messages');
  await expect(inboxTab(page)).toHaveText('Posteingang (1)');
  await openConversation(page, bert);
  await expect(thread(page)).toContainText('Antwort von Bert');

  // Deleting a message removes it from the own view only.
  page.once('dialog', (d) => void d.accept());
  await thread(page)
    .locator('li')
    .filter({ hasText: first })
    .getByRole('button', { name: 'Löschen' })
    .click();
  await expect(thread(page)).not.toContainText(first);
  await expect(thread(page)).toContainText('Antwort von Bert');
  await other.reload();
  await openConversation(other, anna);
  await expect(thread(other)).toContainText(first);

  // Anna keeps the conversation open with a draft in the reply field; Bert
  // writes once more: it comes into her conversation with the next refresh,
  // unasked, the draft stays, and the preview in the list shows it.
  await openReply(page);
  await page.locator('#pm-reply-text').fill('Mein Entwurf');
  await reply(other, 'Zweite Antwort');
  await expect(thread(page)).toContainText('Zweite Antwort', {
    timeout: 10000,
  });
  await expect(page.locator('#pm-reply-text')).toHaveValue('Mein Entwurf');
  await expect(page.locator('#pm-reply .pm-quote')).toContainText(
    'Zweite Antwort',
  );
  await expect(page.locator('.pm-list')).toContainText('Zweite Antwort');

  // The page is no wider than the screen, on a phone too.
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);

  await context.close();
  expect(problems).toEqual([]);
  expect(otherProblems).toEqual([]);
}

test('two players write and reply, the unread mark comes and goes, a message is deleted from one view', async ({
  page,
  browser,
}) => {
  await exchangeFlow(page, browser);
});

test('private messages on a phone @phone', async ({ page, browser }) => {
  await exchangeFlow(page, browser);
});

test('the refusals: oneself, an unknown name, the length and the rate limit', async ({
  page,
  browser,
}) => {
  const { problems } = watch(page);
  const { anna, bert, other, context } = await newPlayers(page, browser);
  await compose(page, anna, 'Hallo ich');
  await expect(refusalIn(page)).toContainText(
    'Du kannst dir nicht selbst schreiben.',
  );
  await compose(page, uniqueName('Niemand'), 'Hallo');
  await expect(refusalIn(page)).toContainText('Spieler nicht gefunden.');
  // The field stops at 1,000 characters; the server refuses more all the same.
  await expect(page.locator('#pm-text')).toHaveAttribute('maxlength', '1000');
  await rested(page);
  expect(
    await refusal(page, {
      type: 'sendPrivateMessage',
      name: bert,
      text: 'a'.repeat(1001),
    }),
  ).toBe('Die Nachricht darf höchstens 1.000 Zeichen haben.');
  expect(
    await refusal(page, { type: 'sendPrivateMessage', name: bert, text: ' ' }),
  ).toBe('Die Nachricht ist leer.');
  // One message every 2 seconds: the second one at once is refused.
  expect(
    await refusal(page, {
      type: 'sendPrivateMessage',
      name: bert,
      text: 'eins',
    }),
  ).toBeUndefined();
  sentAt.set(page, Date.now());
  expect(
    await refusal(page, {
      type: 'sendPrivateMessage',
      name: bert,
      text: 'zwei',
    }),
  ).toBe('Bitte warte kurz vor der nächsten Nachricht.');
  await other.reload();
  await openConversation(other, anna);
  await expect(thread(other)).toContainText('eins');
  await expect(thread(other)).not.toContainText('zwei');
  // Another message of the content of a conversation one is not in is „not there“.
  expect(
    await refusal(page, { type: 'deletePrivateMessage', id: 999_999_999 }),
  ).toBe('Diese Nachricht gibt es nicht.');
  expect(
    await refusal(page, { type: 'reportPrivateMessage', id: 999_999_999 }),
  ).toBe('Diese Nachricht gibt es nicht.');
  await context.close();
  expect(problems).toEqual([]);
});

test('the block list and „nur Freunde“ refuse with one neutral text', async ({
  page,
  browser,
}) => {
  const { problems } = watch(page);
  const { anna, bert, other, context } = await newPlayers(page, browser);

  // Bert blocks Anna by name; Anna's message is refused without saying why.
  await openTab(other, 'Posteingang');
  await other.locator('#pm-block-name').fill(anna);
  await other.locator('#pm-block').getByRole('button').click();
  await expect(lastToast(other)).toContainText('Spieler blockiert.');
  await expect(other.locator('#pm-settings')).toContainText(anna);
  await compose(page, bert, 'Hallo');
  await expect(refusalIn(page)).toContainText(REFUSED);
  await expect(refusalIn(page)).not.toContainText(/blockiert|Freund/);
  // The blocker may still write to the blocked player.
  await compose(other, anna, 'Ich darf');
  await page.reload();
  await openConversation(page, bert);
  await expect(thread(page)).toContainText('Ich darf');

  // Unblocked, the message goes through.
  await other
    .locator('#pm-settings')
    .getByRole('button', { name: 'Freigeben' })
    .click();
  await expect(other.locator('#pm-settings')).not.toContainText(anna);
  await compose(page, bert, 'Wieder da');
  await expect(thread(page)).toContainText('Wieder da');

  // „Nur Freunde dürfen mir schreiben“ refuses a non-friend with the same text.
  await other.locator('#pm-friends-only').check();
  await expect(lastToast(other)).toContainText('Gespeichert.');
  await compose(page, bert, 'Noch einmal');
  await expect(refusalIn(page)).toContainText(REFUSED);
  expect(
    await refusal(page, {
      type: 'sendPrivateMessage',
      name: bert,
      text: 'Noch einmal',
    }),
  ).toBe(REFUSED);
  // Switched off again: the message goes through as soon as the server has it.
  await other.locator('#pm-friends-only').uncheck();
  await rested(page);
  await expect
    .poll(() =>
      refusal(page, {
        type: 'sendPrivateMessage',
        name: bert,
        text: 'Jetzt wieder',
      }),
    )
    .not.toBe(REFUSED);
  await other.reload();
  await openConversation(other, anna);
  await expect(thread(other)).toContainText('Jetzt wieder');

  await context.close();
  expect(problems).toEqual([]);
});

test('a recipient reports a message and the admin sees only that one', async ({
  page,
  browser,
}) => {
  const { problems } = watch(page);
  const { anna, bert, other, context } = await newPlayers(page, browser);
  const admin = uniqueName('Spielleitung');
  // The admin has a browser of their own: `context` is signed in as Bert.
  const adminContext = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  const adminPage = await adminContext.newPage();
  await register(adminPage, admin);
  cli('admin', admin);

  const reported = `Gemeldet ${uniqueName('Text')}`;
  const unreported = `Nicht gemeldet ${uniqueName('Text')}`;
  await compose(page, bert, unreported);
  await compose(page, bert, reported);
  await other.reload();
  await openConversation(other, anna);
  await expect(thread(other)).toContainText(reported);
  // A message the player wrote has no „Melden“; a received one has.
  const row = thread(other).locator('li').filter({ hasText: reported });
  other.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Melden' }).click();
  await expect(lastToast(other)).toContainText('Nachricht gemeldet.');

  await adminPage.reload();
  await nav(adminPage, 'admin');
  await adminPage.getByRole('tab', { name: 'Gemeldete Nachrichten' }).click();
  const list = adminPage.locator('#admin-message-reports');
  await expect(list).toContainText(reported);
  await expect(list).toContainText(anna);
  await expect(list).toContainText(bert);
  await expect(list).not.toContainText(unreported);
  expect(await violations(adminPage)).toEqual([]);

  // The audit log names the report and never the text.
  await adminPage.getByRole('tab', { name: 'Ereignisprotokoll' }).click();
  await adminPage.getByLabel('Aktion', { exact: true }).fill('messageReports');
  await adminPage
    .getByRole('button', { name: 'Anzeigen', exact: true })
    .click();
  const entry = adminPage
    .getByRole('row', { name: /admin.read \/ messageReports/ })
    .first();
  await expect(entry).toBeVisible();
  await expect(adminPage.locator('#admin-diagnostics')).not.toContainText(
    reported,
  );

  await context.close();
  await adminContext.close();
  expect(problems).toEqual([]);
});
