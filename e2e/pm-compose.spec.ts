// The dialog of a message (#349, variant C of the design study; owner,
// 2026-11-21/22): „Neue Nachricht“ and „Antworten“ open a modal dialog
// titled like the button, the focus on the first empty field. The quick
// choice under „Empfänger“ offers the conversations of the inbox
// („Zuletzt geschrieben:“) and the friends („Freunde:“). Enter makes a new
// line, Ctrl+Enter or Cmd+Enter sends, the count „n / 1000“ follows the
// text. „Abbrechen“ and Escape close the dialog, the focus returns to the
// button, and the text stays as a draft over the poll and a switch of the
// tab until it is sent. The reply shows „An {Name}“ and the last message
// received. A refusal shows inside the dialog. On a phone the dialog fills
// the screen. Desktop and phone, with
// axe on both dialogs.
import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { nav, register, uniqueName, watch } from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const GAP_MS = 2100;

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** An action of the page's player; the answer is the error, if any. */
const act = (page: Page, body: object): Promise<string | undefined> =>
  page.evaluate(async (data) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    return ((await r.json()) as { error?: string }).error;
  }, body);

/** The id of the player `name`, from the state of the page. */
const idOf = (page: Page, name: string): Promise<string> =>
  page.evaluate(async (who) => {
    const r = await fetch('/api/state');
    const s = (await r.json()) as {
      players: Record<string, { name: string }>;
    };
    return Object.entries(s.players).find(([, p]) => p.name === who)![0];
  }, name);

/** A page of a player of its own, at the size of the first page. */
async function player(
  page: Page,
  browser: Browser,
  base: string,
): Promise<{ name: string; page: Page; close: () => Promise<void> }> {
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  const other = await context.newPage();
  const name = uniqueName(base);
  await register(other, name);
  return { name, page: other, close: () => context.close() };
}

const dialogOf = (page: Page, id: 'pm-compose' | 'pm-reply'): Locator =>
  page.locator(`#${id}`);

/** Checks that the dialog fills the screen on a phone and stays at most 560 px wide elsewhere. */
async function expectSize(page: Page, dialog: Locator): Promise<void> {
  const box = (await dialog.boundingBox())!;
  const view = page.viewportSize()!;
  if (view.width <= 760) {
    expect(Math.round(box.width)).toBe(view.width);
    expect(Math.round(box.height)).toBe(view.height);
  } else expect(box.width).toBeLessThanOrEqual(560);
}

async function dialogFlow(page: Page, browser: Browser): Promise<void> {
  const { problems } = watch(page);
  const anna = uniqueName('Schreiberin');
  await register(page, anna);
  const bert = await player(page, browser, 'Briefpartner');
  const cora = await player(page, browser, 'Freundin');

  // Bert has written to Anna; Cora is Anna's friend.
  const bertWrote = Date.now();
  expect(
    await act(bert.page, {
      type: 'sendPrivateMessage',
      name: anna,
      text: 'Hallo Anna',
    }),
  ).toBeUndefined();
  expect(
    await act(cora.page, { type: 'requestFriend', name: anna }),
  ).toBeUndefined();
  expect(
    await act(page, {
      type: 'answerFriend',
      uid: await idOf(page, cora.name),
      accept: true,
    }),
  ).toBeUndefined();

  // „Neue Nachricht“ opens the dialog, the focus on the empty recipient.
  await page.reload();
  await nav(page, 'messages');
  await page.getByRole('tab', { name: /^Posteingang/ }).click();
  const open = page.getByRole('button', { name: 'Neue Nachricht' });
  await open.click();
  const compose = dialogOf(page, 'pm-compose');
  await expect(
    page.getByRole('dialog', { name: 'Neue Nachricht' }),
  ).toBeVisible();
  await expect(page.locator('#pm-to')).toBeFocused();
  await expectSize(page, compose);

  // The quick choice: Bert from the inbox, Cora among the friends.
  const recent = compose.getByRole('button', { name: bert.name });
  const friend = compose.getByRole('button', { name: cora.name });
  await expect(compose.locator('#pm-quick-recent')).toHaveText(
    'Zuletzt geschrieben:',
  );
  await expect(compose.locator('#pm-quick-friends')).toHaveText('Freunde:');
  await expect(recent).toHaveAttribute('aria-describedby', 'pm-quick-recent');
  await expect(friend).toHaveAttribute('aria-describedby', 'pm-quick-friends');
  await expect(recent).toHaveAttribute('aria-pressed', 'false');
  expect(await violations(page)).toEqual([]);
  await friend.click();
  await expect(page.locator('#pm-to')).toHaveValue(cora.name);
  await expect(friend).toHaveAttribute('aria-pressed', 'true');
  await recent.click();
  await expect(page.locator('#pm-to')).toHaveValue(bert.name);
  await expect(recent).toHaveAttribute('aria-pressed', 'true');
  await expect(friend).toHaveAttribute('aria-pressed', 'false');

  // Enter makes a new line; the count follows the text.
  const text = page.locator('#pm-text');
  await text.click();
  await page.keyboard.type('Zeile eins');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Zeile zwei');
  await expect(text).toHaveValue('Zeile eins\nZeile zwei');
  await expect(compose).toBeVisible();
  await expect(page.locator('#pm-text-count')).toHaveText('21 / 1000');

  // Escape closes it, the focus returns, the draft stays for the next opening.
  await page.keyboard.press('Escape');
  await expect(compose).toBeHidden();
  await expect(open).toBeFocused();
  await open.click();
  await expect(page.locator('#pm-to')).toHaveValue(bert.name);
  await expect(text).toHaveValue('Zeile eins\nZeile zwei');
  await expect(text).toBeFocused();

  // „Abbrechen“ too, and the draft stays over a switch of the tab.
  await compose.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(compose).toBeHidden();
  await expect(open).toBeFocused();
  await page.getByRole('tab', { name: 'Gesendet' }).click();
  await page.getByRole('tab', { name: /^Posteingang/ }).click();
  await open.click();
  await expect(text).toHaveValue('Zeile eins\nZeile zwei');

  // The poll brings a new message while the dialog is open: the draft stays.
  await expect.poll(() => Date.now() - bertWrote).toBeGreaterThan(GAP_MS);
  expect(
    await act(bert.page, {
      type: 'sendPrivateMessage',
      name: anna,
      text: 'Noch da?',
    }),
  ).toBeUndefined();
  await expect(page.locator('.pm-list')).toContainText('Noch da?', {
    timeout: 10000,
  });
  await expect(text).toHaveValue('Zeile eins\nZeile zwei');
  await expect(page.locator('#pm-to')).toHaveValue(bert.name);

  // A refusal shows inside the dialog with the server's words, in the modal
  // (not inert, nothing on top of it); the dialog and the text stay. It goes
  // with the dialog and when the recipient changes.
  const refusal = compose.getByRole('alert');
  await page.locator('#pm-to').fill(uniqueName('Niemand'));
  await compose.getByRole('button', { name: 'Senden', exact: true }).click();
  await expect(refusal).toHaveText('Spieler nicht gefunden.');
  await expect(refusal).toBeVisible();
  expect(
    await refusal.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        r.left + r.width / 2,
        r.top + r.height / 2,
      );
      return (
        !el.closest('[inert]') &&
        document.querySelector('dialog:modal')?.contains(el) === true &&
        (top === el || el.contains(top))
      );
    }),
  ).toBe(true);
  await expect(compose).toBeVisible();
  await expect(text).toHaveValue('Zeile eins\nZeile zwei');
  await page.keyboard.press('Escape');
  await open.click();
  await expect(refusal).toHaveCount(0);
  await expect(text).toHaveValue('Zeile eins\nZeile zwei');
  await compose.getByRole('button', { name: 'Senden', exact: true }).click();
  await expect(refusal).toHaveText('Spieler nicht gefunden.');
  await recent.click();
  await expect(refusal).toHaveCount(0);
  await expect(page.locator('#pm-to')).toHaveValue(bert.name);

  // Ctrl+Enter sends; the conversation opens and the draft is gone.
  await text.press('Control+Enter');
  const sentAt = Date.now();
  await expect(compose).toBeHidden();
  const thread = page.locator('#pm-thread');
  // The server takes the line break out of the text (`clean`, unchanged by
  // #349): both lines arrive.
  await expect(thread.getByRole('log')).toContainText('Zeile eins');
  await expect(thread.getByRole('log')).toContainText('Zeile zwei');
  await open.click();
  await expect(page.locator('#pm-to')).toHaveValue('');
  await expect(text).toHaveValue('');
  await expect(page.locator('#pm-to')).toBeFocused();
  await compose.getByRole('button', { name: 'Abbrechen' }).click();

  // „Antworten“ opens the reply: „An Bert“, his last message quoted, the
  // focus on the text.
  const answer = thread.getByRole('button', { name: 'Antworten' });
  await answer.click();
  const replyDialog = dialogOf(page, 'pm-reply');
  await expect(page.getByRole('dialog', { name: 'Antworten' })).toBeVisible();
  await expect(replyDialog.locator('.pm-to')).toHaveText(`An ${bert.name}`);
  await expect(replyDialog.locator('.pm-quote')).toContainText(
    `Letzte Nachricht von ${bert.name}`,
  );
  await expect(replyDialog.locator('.pm-quote')).toContainText('Noch da?');
  const replyText = page.locator('#pm-reply-text');
  await expect(replyText).toBeFocused();
  await expectSize(page, replyDialog);
  expect(await violations(page)).toEqual([]);

  // A draft of the reply stays over Escape and „Abbrechen“.
  await replyText.fill('Ja, ich bin da.');
  await expect(page.locator('#pm-reply-text-count')).toHaveText('15 / 1000');
  await page.keyboard.press('Escape');
  await expect(replyDialog).toBeHidden();
  await expect(answer).toBeFocused();
  await answer.click();
  await expect(replyText).toHaveValue('Ja, ich bin da.');
  await replyDialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(answer).toBeFocused();
  await answer.click();
  await expect(replyText).toHaveValue('Ja, ich bin da.');

  // Cmd+Enter sends the reply (one message every 2 s per sender).
  await expect.poll(() => Date.now() - sentAt).toBeGreaterThan(GAP_MS);
  await replyText.press('Meta+Enter');
  await expect(replyDialog).toBeHidden();
  await expect(thread.getByRole('log')).toContainText('Ja, ich bin da.');
  await answer.click();
  await expect(replyText).toHaveValue('');
  await replyDialog.getByRole('button', { name: 'Abbrechen' }).click();

  await bert.close();
  await cora.close();
  expect(problems).toEqual([]);
}

test('the dialog of a message: quick choice, drafts, Ctrl+Enter and the reply (#349)', async ({
  page,
  browser,
}) => {
  await dialogFlow(page, browser);
});

test('the dialog of a message on a phone fills the screen (#349) @phone', async ({
  page,
  browser,
}) => {
  await dialogFlow(page, browser);
});
