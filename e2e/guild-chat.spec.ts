// The guild chat (#169): two members chat, the chat follows the normal state
// refresh, texts are shown as plain text, a rank without the rights sees and
// sends nothing and the server refuses it, the Leitung deletes, a member who
// left shows as „ehemaliges Mitglied“, an outsider gets nothing, and the
// admin reads the chat with an entry in the audit log. The server writes
// events (joining, a new rank, an attack at its launch, removal), the box
// says that the game master reads it, and „Gilden“ has a red mark for news
// until the member opens its guild (owner, 2026-11-15). Desktop and phone.
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  cli,
  galaxyRow,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const lastToast = (page: Page): Locator => page.locator('.toast').last();
const applicant = (p: Page, name: string): Locator =>
  p.locator('p', { hasText: name });
const log = (p: Page): Locator => p.getByRole('log', { name: 'Chat' });
const XSS = '<img src=x onerror="window.chatXss=1">';
const NOTICE = 'Die Spielleitung kann diesen Chat lesen.';
const MARK = 'Neue Nachrichten im Gilden-Chat';
/** The red mark on „Gilden“: the side menu, or the list under „Mehr“ on a phone. */
const mark = (p: Page): Locator =>
  p.locator(
    `#menu [data-v=guilds] .badge[aria-label="${MARK}"], #more-list [data-v=guilds] .badge[aria-label="${MARK}"]`,
  );

/** A game action sent by hand, as from a device that still shows a button. */
async function action(page: Page, data: object): Promise<string | undefined> {
  return page.evaluate(async (body) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return ((await r.json()) as { error?: string }).error;
  }, data);
}

async function send(page: Page, text: string): Promise<void> {
  await page.getByLabel('Nachricht', { exact: true }).fill(text);
  await page.getByRole('button', { name: 'Senden' }).click();
}

interface Guild {
  lead: Page;
  member: Page;
  leadName: string;
  memberName: string;
  title: string;
  tag: string;
  problems: { problems: string[] }[];
}

/** Founds a guild, and a second player joins it. */
async function guild(page: Page, browser: Browser): Promise<Guild> {
  const leadName = uniqueName('Kanzler');
  const memberName = uniqueName('Bote');
  const tag = `C${Date.now() % 1000000}`;
  const title = `[${tag}] Chat ${tag}`;
  const problems = [watch(page)];
  await register(page, leadName);
  await nav(page, 'guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(`Chat ${tag}`);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  const member = await browser.newPage();
  problems.push(watch(member));
  await register(member, memberName);
  await nav(member, 'guilds');
  await member.getByRole('link', { name: title }).click();
  // Not a member yet: no chat.
  await expect(member.getByLabel('Nachricht', { exact: true })).toHaveCount(0);
  await member.getByRole('button', { name: 'Bewerben' }).click();
  await expect(lastToast(member)).toContainText('Bewerbung gesendet.');
  await page.reload();
  await applicant(page, memberName)
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(lastToast(page)).toContainText('Bewerbung angenommen.');
  await member.reload();
  return { lead: page, member, leadName, memberName, title, tag, problems };
}

async function chatFlow(page: Page, browser: Browser): Promise<void> {
  const g = await guild(page, browser);
  const { lead, member } = g;
  // The first entry is the event of the server (#169 D4).
  await expect(log(lead).locator('li')).toHaveText([
    new RegExp(`${g.memberName} ist der Gilde beigetreten\\.$`),
  ]);

  // The Leitung writes; the member sees it with the next refresh, unasked.
  await send(lead, 'Willkommen im Bund');
  await expect(log(lead)).toContainText('Willkommen im Bund');
  await expect(lead.getByLabel('Nachricht', { exact: true })).toHaveValue('');
  await expect(log(member)).toContainText('Willkommen im Bund', {
    timeout: 10000,
  });
  await expect(
    log(member).locator('li', { hasText: 'Willkommen im Bund' }),
  ).toContainText(g.leadName);

  // Plain text: markup of a player is shown, never run.
  await send(member, XSS);
  await expect(log(member).getByText(XSS)).toBeVisible();
  await lead.reload();
  await expect(log(lead).getByText(XSS)).toBeVisible();
  await expect(log(lead).locator('img')).toHaveCount(0);
  expect(await lead.evaluate(() => 'chatXss' in window)).toBe(false);

  // One message every 2 seconds; at most 1,000 characters.
  await member.waitForTimeout(2100);
  await send(member, 'eins');
  await expect(log(member)).toContainText('eins');
  await send(member, 'zwei');
  await expect(lastToast(member)).toContainText(
    'Bitte warte kurz vor der nächsten Nachricht.',
  );
  await expect(member.getByLabel('Nachricht', { exact: true })).toHaveAttribute(
    'maxlength',
    '1000',
  );
  expect(
    await action(member, { type: 'sendGuildChat', text: 'x'.repeat(1001) }),
  ).toBe('Die Nachricht darf höchstens 1.000 Zeichen haben.');

  // A Mitglied may not delete: no button, and the server refuses.
  await expect(
    log(member).getByRole('button', { name: 'Löschen' }),
  ).toHaveCount(0);
  const id = await log(lead)
    .getByRole('button', { name: 'Löschen' })
    .first()
    .getAttribute('data-id');
  expect(
    await action(member, { type: 'deleteGuildChat', id: Number(id) }),
  ).toBe('Dazu fehlt deinem Rang das Recht.');

  // The Leitung deletes the message with the markup.
  await lead.reload();
  lead.once('dialog', (d) => void d.accept());
  await log(lead)
    .locator('li', { hasText: XSS })
    .getByRole('button', { name: 'Löschen' })
    .click();
  await expect(lastToast(lead)).toContainText('Nachricht gelöscht.');
  await expect(log(lead).getByText(XSS)).toHaveCount(0);

  // An outsider sees no chat and gets none from the server.
  const outsider = await browser.newPage();
  g.problems.push(watch(outsider));
  await register(outsider, uniqueName('Fremder'));
  await nav(outsider, 'guilds');
  await outsider.getByRole('link', { name: g.title }).click();
  await expect(outsider.getByRole('heading', { name: g.title })).toBeVisible();
  await expect(log(outsider)).toHaveCount(0);
  const state = await outsider.evaluate(async () =>
    (await fetch('/api/state')).text(),
  );
  expect(state).not.toContain('Willkommen im Bund');
  expect(
    await action(outsider, { type: 'sendGuildChat', text: 'Hallo?' }),
  ).toBe('Du bist in keiner Gilde.');

  // The member leaves: the access ends, the messages stay without the name.
  member.once('dialog', (d) => void d.accept());
  await member.getByRole('button', { name: 'Gilde verlassen' }).click();
  await expect(lastToast(member)).toContainText('Gilde verlassen.');
  // The page of the guild stays open, now without the chat.
  await expect(member.getByRole('heading', { name: g.title })).toBeVisible();
  await expect(member.getByRole('button', { name: 'Bewerben' })).toBeVisible();
  await expect(log(member)).toHaveCount(0);
  await lead.reload();
  await expect(log(lead).locator('li', { hasText: 'eins' })).toContainText(
    'ehemaliges Mitglied',
  );
  // The message hides the name; the event of leaving names the member.
  await expect(log(lead).locator('li', { hasText: 'eins' })).not.toContainText(
    g.memberName,
  );
  await expect(log(lead).locator('li').last()).toContainText(
    `${g.memberName} hat die Gilde verlassen.`,
  );
  for (const p of [member, outsider]) await p.close();
  expect(g.problems.flatMap((w) => w.problems)).toEqual([]);
}

/** The Leitung takes „Chat lesen“ and then „Chat schreiben“ from Mitglied. */
async function rightsFlow(page: Page, browser: Browser): Promise<void> {
  const g = await guild(page, browser);
  const { lead, member } = g;
  await send(lead, 'Nur für Leser');
  const rank = lead.getByRole('group', { name: /^Mitglied/ });
  const save = async () => {
    await rank.getByRole('button', { name: 'Rechte speichern' }).click();
    await expect(lastToast(lead)).toContainText('Rechte gespeichert.');
  };
  await expect(rank.getByLabel('Chat lesen')).toBeChecked();
  await expect(rank.getByLabel('Chat schreiben')).toBeChecked();
  await expect(rank.getByLabel('Chatnachrichten löschen')).not.toBeChecked();
  await rank.getByLabel('Chat lesen').uncheck();
  await save();
  await member.reload();
  await expect(log(member)).toHaveCount(0);
  await expect(member.getByText('Nur für Leser')).toHaveCount(0);
  await expect(member.getByLabel('Nachricht', { exact: true })).toBeVisible();
  await rank.getByLabel('Chat schreiben').uncheck();
  await save();
  await member.reload();
  await expect(member.getByLabel('Nachricht', { exact: true })).toHaveCount(0);
  expect(
    await action(member, { type: 'sendGuildChat', text: 'trotzdem' }),
  ).toBe('Dazu fehlt deinem Rang das Recht.');
  await member.close();
  expect(g.problems.flatMap((w) => w.problems)).toEqual([]);
}

/** The admin reads the chat of a guild it is not in; the audit log records it. */
async function adminFlow(page: Page, browser: Browser): Promise<void> {
  const g = await guild(page, browser);
  await send(g.lead, `Interna ${g.tag}`);
  const admin = await browser.newPage();
  g.problems.push(watch(admin));
  const name = uniqueName('Aufsicht');
  await register(admin, name);
  // Without the admin right there is no button, and the server refuses.
  await nav(admin, 'guilds');
  await admin.getByRole('link', { name: g.title }).click();
  await expect(admin.getByRole('button', { name: 'Chat lesen' })).toHaveCount(
    0,
  );
  cli('admin', name);
  await admin.reload();
  await admin.getByRole('button', { name: 'Chat lesen' }).click();
  const dialog = admin.locator('#modal');
  await expect(
    dialog.getByRole('heading', { name: `Chat ${g.title}` }),
  ).toBeVisible();
  await expect(log(admin)).toContainText(`Interna ${g.tag}`);
  await expect(log(admin)).toContainText(g.leadName);
  await expect(dialog.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Schließen' }).click();
  await expect(dialog).toBeHidden();
  const events = await admin.evaluate(async () => {
    const r = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'guildChat' }),
    });
    return (await r.json()) as {
      events: { category: string; outcome: string; detail: string }[];
    };
  });
  const id = await g.lead.evaluate(
    async () =>
      (
        (await (await fetch('/api/state')).json()) as {
          guilds: { own: { id: string } };
        }
      ).guilds.own.id,
  );
  expect(events.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        category: 'admin.read',
        outcome: 'ok',
        detail: JSON.stringify({ guild: id }),
      }),
    ]),
  );
  cli('unadmin', name);
  await admin.close();
  await g.member.close();
  expect(g.problems.flatMap((w) => w.problems)).toEqual([]);
}

/**
 * The events of the server, the notice and the red mark (owner,
 * 2026-11-15): joining, a new rank, an attack at its launch and removal.
 */
async function eventsFlow(page: Page, browser: Browser): Promise<void> {
  const g = await guild(page, browser);
  const { lead, member } = g;
  for (const p of [lead, member]) {
    await expect(p.getByText(NOTICE)).toBeVisible();
    await expect(log(p)).toContainText(
      `${g.memberName} ist der Gilde beigetreten.`,
    );
  }

  // The red mark: a message while the Leitung is elsewhere. It goes once
  // the Leitung opens the page of its guild, and stays gone.
  await nav(lead, 'overview');
  await expect(mark(lead)).toHaveCount(0);
  await send(member, 'Neuigkeit');
  await expect(log(member)).toContainText('Neuigkeit');
  await expect(mark(lead)).toHaveCount(1, { timeout: 10000 });
  await nav(lead, 'guilds');
  await expect(mark(lead)).toHaveCount(1);
  await lead.getByRole('link', { name: g.title }).click();
  await expect(log(lead)).toContainText('Neuigkeit');
  await expect(mark(lead)).toHaveCount(0, { timeout: 10000 });
  await lead.reload();
  await expect(log(lead)).toContainText('Neuigkeit');
  await expect(mark(lead)).toHaveCount(0);
  // The writer's own message is never new for the writer.
  await expect(mark(member)).toHaveCount(0);

  // A new rank.
  await lead.getByLabel('Name des neuen Rangs').fill('Offizier');
  await lead.getByRole('button', { name: 'Rang anlegen' }).click();
  await expect(lastToast(lead)).toContainText('Rang angelegt.');
  const row = lead.locator('tr').filter({
    has: lead.getByRole('cell', { name: g.memberName, exact: true }),
  });
  await row
    .getByLabel(`Neuer Rang für ${g.memberName}`)
    .selectOption({ label: 'Offizier' });
  await row.getByRole('button', { name: 'Rang ändern' }).click();
  await expect(lastToast(lead)).toContainText('Rang vergeben.');
  await expect(log(lead)).toContainText(`${g.memberName} ist jetzt Offizier.`);

  // An attack at the member, at its launch: target, attacker, member and
  // arrival. The attacker learns nothing of the chat.
  const vexName = uniqueName('Vex');
  const vex = await browser.newPage();
  g.problems.push(watch(vex));
  await register(vex, vexName);
  seed({ name: vexName, ships: { lf: 5 }, res: { m: 0, c: 0, d: 10000 } });
  seed({ name: g.memberName, b: { metal: 12, crystal: 10 } });
  const target = await member.evaluate(async () => {
    const s = (await (await fetch('/api/state')).json()) as {
      planet: { g: number; s: number; p: number };
    };
    return s.planet;
  });
  await vex.reload();
  await nav(vex, 'highscore');
  await vex
    .locator('tr')
    .filter({ has: vex.getByRole('cell', { name: g.memberName, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await expect(vex.locator('h2')).toHaveText('Sternenkarte');
  await galaxyRow(vex, g.memberName).getByText('Sturmangriff').click();
  await expect(vex.getByLabel('Auftrag')).toHaveValue('attack');
  await vex.getByLabel('Anzahl Abfangjäger').fill('1');
  await vex.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(vex)).toContainText('Flotte unterwegs nach');
  const where = `\\[${target.g}:${target.s}:${target.p}\\]`;
  const attack = new RegExp(
    `⚔ Angriff auf ${where} \\(${vexName} → ${g.memberName}\\), Ankunft (\\d\\d\\.\\d\\d\\., )?\\d\\d:\\d\\d$`,
  );
  for (const p of [lead, member])
    await expect(log(p).locator('li').last()).toHaveText(attack, {
      timeout: 10000,
    });
  expect(
    await vex.evaluate(async () => (await fetch('/api/state')).text()),
  ).not.toContain('Angriff auf');

  // Removal; an event can be deleted by nobody, not even the Leitung.
  lead.once('dialog', (d) => void d.accept());
  await row.getByRole('button', { name: 'Entfernen' }).click();
  await expect(lastToast(lead)).toContainText('Mitglied entfernt.');
  await expect(log(lead).locator('li').last()).toContainText(
    `${g.memberName} wurde aus der Gilde entfernt.`,
  );
  const events = log(lead).locator('li', { hasText: g.memberName });
  await expect(events).toHaveCount(4);
  await expect(events.getByRole('button', { name: 'Löschen' })).toHaveCount(0);
  for (const p of [member, vex]) await p.close();
  expect(g.problems.flatMap((w) => w.problems)).toEqual([]);
}

test.describe('the guild chat (#169)', () => {
  test('two members chat; plain text, the limits, deleting, leaving and outsiders', async ({
    page,
    browser,
  }) => {
    await chatFlow(page, browser);
  });

  test('the rights „Chat lesen“ and „Chat schreiben“ of a rank', async ({
    page,
    browser,
  }) => {
    await rightsFlow(page, browser);
  });

  test('the admin reads a guild chat, recorded in the audit log', async ({
    page,
    browser,
  }) => {
    await adminFlow(page, browser);
  });

  test('the events of the server, the notice and the red mark on „Gilden“', async ({
    page,
    browser,
  }) => {
    await eventsFlow(page, browser);
  });

  test('the events, the notice and the red mark on a phone @phone', async ({
    page,
    browser,
  }) => {
    await eventsFlow(page, browser);
  });

  test('two members chat on a phone @phone', async ({ page, browser }) => {
    await chatFlow(page, browser);
  });

  test('the rights of a rank on a phone @phone', async ({ page, browser }) => {
    await rightsFlow(page, browser);
  });

  test('the admin reads a guild chat on a phone @phone', async ({
    page,
    browser,
  }) => {
    await adminFlow(page, browser);
  });
});
