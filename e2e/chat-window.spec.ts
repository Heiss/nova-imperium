// The chat window at the bottom right (#496, owner, 2026-11-28): on the
// desktop a button „Chat“ with the unread entries opens a window with the
// tabs „Gilde“ (the guild chat) and „Persönlich“ (the conversations and the
// open one with „Antworten“); a member writes in it, sees what is new, and
// the chat in sight clears its mark. The window stays open over a reload. The
// guild chat is also a tab „Gilde“ under „Nachrichten“, where the window is
// gone. The switch „Chatfenster“ of the round takes the window away. On a
// phone there is no window and no button; „Nachrichten“ has the tab „Gilde“.
// The words of the window are drafts [V] of the build.
import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  cli,
  guildTag,
  lastToast,
  nav,
  register,
  uniqueName,
  watch,
} from './helpers.ts';

const chatwin = (page: Page): Locator => page.locator('#chatwin');
const opener = (page: Page): Locator =>
  chatwin(page).locator('button.chatwin-open');
const tab = (page: Page, name: RegExp): Locator =>
  chatwin(page).getByRole('tab', { name });
const windowLog = (page: Page): Locator =>
  chatwin(page).getByRole('log', { name: 'Chat' });

interface Guild {
  lead: Page;
  member: Page;
  leadName: string;
  memberName: string;
  problems: { problems: string[] }[];
}

/** Founds a guild, and a second player joins it (as in guild-chat.spec.ts). */
async function guild(page: Page, browser: Browser): Promise<Guild> {
  const leadName = uniqueName('Fenster');
  const memberName = uniqueName('Funker');
  const tag = guildTag('W');
  const title = `[${tag}] Fenster ${tag}`;
  const problems = [watch(page)];
  await register(page, leadName);
  await nav(page, 'guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(`Fenster ${tag}`);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const member = await browser.newPage({ viewport: page.viewportSize() });
  problems.push(watch(member));
  await register(member, memberName);
  await nav(member, 'guilds');
  await member.getByRole('link', { name: title }).click();
  await member.getByRole('button', { name: 'Bewerben' }).click();
  await expect(lastToast(member)).toContainText('Bewerbung gesendet.');
  await page.reload();
  await page
    .locator('p', { hasText: memberName })
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(lastToast(page)).toContainText('Bewerbung angenommen.');
  await member.reload();
  return { lead: page, member, leadName, memberName, problems };
}

/** Sends a guild chat message from the page of the guild. */
async function sayOnPage(page: Page, text: string): Promise<void> {
  await page.locator('#chat_text').fill(text);
  await page
    .locator('#guildchatform')
    .getByRole('button', { name: 'Senden' })
    .click();
  await expect(page.locator('#chat_text')).toHaveValue('');
}

/** The admin sets „Chatfenster“ in „Universum“ and saves. */
async function switchWindow(admin: Page, on: '0' | '1'): Promise<void> {
  await nav(admin, 'admin');
  await admin.getByRole('tab', { name: 'Universum' }).click();
  await admin.getByLabel('Chatfenster', { exact: true }).selectOption(on);
  await admin.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(lastToast(admin)).toContainText('Einstellungen gespeichert.');
}

test.describe('the chat window (#496)', () => {
  test('a member reads and writes in „Gilde“ and „Persönlich“, the counts go with what is seen, the window stays open', async ({
    page,
    browser,
  }) => {
    test.slow();
    const g = await guild(page, browser);
    const { lead, member } = g;
    // Away from the page of the guild, so the chat is not seen there.
    await nav(lead, 'overview');
    await expect(opener(lead)).toHaveText(/^Chat/);
    await expect(opener(lead)).toHaveAttribute('aria-expanded', 'false');

    // A message of the member: „Chat (n)“ on the closed window.
    await lead.waitForTimeout(2100);
    await sayOnPage(member, 'Hallo Fenster');
    await expect(opener(lead)).toHaveText(/^Chat \(\d+\)$/, {
      timeout: 15000,
    });
    await opener(lead).click();
    await expect(
      chatwin(lead).getByRole('heading', { name: 'Chat' }),
    ).toBeVisible();
    // „Gilde“ first; in sight, its count goes.
    await expect(tab(lead, /^Gilde/)).toHaveAttribute('aria-selected', 'true');
    await expect(windowLog(lead)).toContainText('Hallo Fenster');
    await expect(tab(lead, /^Gilde/)).toHaveText('Gilde', { timeout: 10000 });
    await expect(chatwin(lead)).toContainText(
      'Die Spielleitung kann diesen Chat lesen.',
    );

    // The lead writes in the window; the member reads it on the page.
    await chatwin(lead).locator('#chat_text-window').fill('Antwort im Fenster');
    await chatwin(lead).getByRole('button', { name: 'Senden' }).click();
    await expect(chatwin(lead).locator('#chat_text-window')).toHaveValue('');
    await expect(
      member.getByRole('log', { name: 'Chat' }).first(),
    ).toContainText('Antwort im Fenster', { timeout: 10000 });

    // A private message of the member: „Persönlich (1)“, the conversation and
    // „Antworten“ in the window.
    await nav(member, 'messages');
    await member.getByRole('tab', { name: /^Posteingang/ }).click();
    await member.getByRole('button', { name: 'Neue Nachricht' }).click();
    await member.locator('#pm-to').fill(g.leadName);
    await member.locator('#pm-text').fill('Privat an dich');
    await member
      .locator('#pm-compose')
      .getByRole('button', { name: 'Senden', exact: true })
      .click();
    await expect(tab(lead, /^Persönlich/)).toHaveText('Persönlich (1)', {
      timeout: 15000,
    });
    await tab(lead, /^Persönlich/).click();
    await chatwin(lead)
      .locator('.pm-list')
      .getByRole('button', { name: new RegExp(`^${g.memberName}`) })
      .click();
    await expect(chatwin(lead).locator('#pm-thread')).toContainText(
      'Privat an dich',
    );
    await expect(tab(lead, /^Persönlich/)).toHaveText('Persönlich', {
      timeout: 10000,
    });
    await chatwin(lead)
      .locator('#pm-thread')
      .getByRole('button', { name: 'Antworten' })
      .click();
    await lead.locator('#pm-reply-text').fill('Danke, gelesen');
    await lead
      .locator('#pm-reply')
      .getByRole('button', { name: 'Antworten', exact: true })
      .click();
    await expect(chatwin(lead).locator('#pm-thread')).toContainText(
      'Danke, gelesen',
    );

    // No axe violation in the open window.
    const results = await new AxeBuilder({ page: lead })
      .include('#chatwin')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Open on „Persönlich“ over a reload; closed, it stays closed.
    await lead.reload();
    await expect(tab(lead, /^Persönlich/)).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await chatwin(lead).getByRole('button', { name: 'Chat schließen' }).click();
    await lead.reload();
    await expect(opener(lead)).toBeVisible();

    // „Nachrichten“ has the tab „Gilde“ with the same chat; the window is gone there.
    await nav(lead, 'messages');
    await expect(chatwin(lead).locator('button')).toHaveCount(0);
    await lead.getByRole('tab', { name: /^Gilde/ }).click();
    await expect(
      lead.locator('#messages-panel-guild').getByRole('log', { name: 'Chat' }),
    ).toContainText('Antwort im Fenster');
    expect(g.problems.flatMap((w) => w.problems)).toEqual([]);
  });

  test('the switch „Chatfenster“ of the round takes the window away, and brings it back', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Schalter');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await expect(opener(page)).toBeVisible();
    try {
      await switchWindow(page, '0');
      await page.reload();
      await expect(page.locator('#view')).not.toBeEmpty();
      await expect(chatwin(page).locator('button')).toHaveCount(0);
    } finally {
      await switchWindow(page, '1');
    }
    await page.reload();
    await expect(opener(page)).toBeVisible();
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });

  test('has no window on a phone; „Nachrichten“ has the tab „Gilde“ @phone', async ({
    page,
    browser,
  }) => {
    test.slow();
    const g = await guild(page, browser);
    await expect(chatwin(g.lead).locator('button')).toHaveCount(0);
    await expect(chatwin(g.lead)).toBeHidden();
    await g.lead.waitForTimeout(2100);
    await sayOnPage(g.member, 'Am Telefon');
    await nav(g.lead, 'messages');
    await g.lead.getByRole('tab', { name: /^Gilde/ }).click();
    const panel = g.lead.locator('#messages-panel-guild');
    await expect(panel.getByRole('log', { name: 'Chat' })).toContainText(
      'Am Telefon',
      { timeout: 10000 },
    );
    await panel.locator('#chat_text-messages').fill('Vom Telefon');
    await panel.getByRole('button', { name: 'Senden' }).click();
    await expect(panel.getByRole('log', { name: 'Chat' })).toContainText(
      'Vom Telefon',
    );
    expect(g.problems.flatMap((w) => w.problems)).toEqual([]);
  });
});
