import { execFileSync } from 'node:child_process';
import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_ENV, E2E_MAILBOX, E2E_MAIL_ENV, E2E_MAIL_URL } from './env.ts';
import { mailsTo } from './mail.ts';
import {
  isOwnName,
  nextHome,
  ownArea,
  ownNames,
  uniqueName,
} from './own-data.ts';

// What the specs get from one place (#302): their own players, area and guild
// tags. A spec asks for nothing of this by a fixed value.
export { guildTag, ownArea, uniqueName } from './own-data.ts';

const run = (
  script: string,
  args: string[],
  env: Record<string, string> = E2E_ENV,
): string =>
  execFileSync(process.execPath, [script, ...args], {
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });

/** The operator command `nova …` against the server under test. */
export const cli = (...args: string[]): string =>
  run('src/server/cli.ts', args);

/**
 * Changes the data of a player of the running test (e2e/seed.ts). The call
 * names the area of the test, and the seed command refuses planets outside it.
 */
export function seed(data: { name: string; [field: string]: unknown }): string {
  if (!isOwnName(data.name))
    throw new Error(
      `seed({ name: "${data.name}" }): the player was not handed out to this test by uniqueName() (e2e/own-data.ts); every test makes its own players.`,
    );
  const { n, g, s } = ownArea();
  return run('e2e/seed.ts', [JSON.stringify({ ...data, area: { n, g, s } })]);
}

/** `cli` and `seed` against the second server, the one that sends mails (#68). */
export const mailCli = (...args: string[]): string =>
  run('src/server/cli.ts', args, E2E_MAIL_ENV);

export const mailSeed = (data: object): string =>
  run('e2e/seed.ts', [JSON.stringify(data)], E2E_MAIL_ENV);

/** Waits for a mail to `to` that matches `pattern`; the newest one counts. */
export async function mail(
  to: string,
  pattern: RegExp,
): Promise<RegExpExecArray> {
  const found: { match: RegExpExecArray | null } = { match: null };
  await expect
    .poll(
      () => {
        const texts = mailsTo(E2E_MAILBOX, to).reverse();
        found.match =
          texts.map((t) => pattern.exec(t)).find((m) => m !== null) ?? null;
        return found.match !== null;
      },
      { message: `a mail to ${to} with ${pattern}`, timeout: 10000 },
    )
    .toBe(true);
  return found.match!;
}

export function inviteLink(email: string): string {
  const link = cli('invite', email)
    .split('\n')
    .find((l) => l.includes('#invite='));
  if (!link) throw new Error('no invitation link');
  return link.replace(/^https?:\/\/[^/]+/, '');
}

/**
 * Collects Content-Security-Policy violations and script errors of a page.
 * Expected and not counted: the browser logs the answers 400 (a refused game
 * action, a wrong password) and 401 (not logged in yet) of the JSON API.
 */
export function watch(page: Page): { problems: string[] } {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const expected =
      /^Failed to load resource: the server responded with a status of 40[01] /.test(
        m.text(),
      );
    if (m.type() === 'error' && !expected)
      problems.push(`console: ${m.text()}`);
  });
  void page.addInitScript(() =>
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`),
    ),
  );
  return { problems };
}

/**
 * Registers the player with an invitation and puts the home planet in the
 * area of the running test. The name comes from `uniqueName()`.
 */
export async function register(
  page: Page,
  name: string,
  password = 'ein-sicheres-testpasswort',
): Promise<void> {
  const email = emailOf(name);
  await page.goto(inviteLink(email));
  await expect(page.locator('#a_email')).toHaveValue(email);
  await page.fill('#a_name', name);
  await page.fill('#a_pw', password);
  await page.click('button[type=submit]');
  await expect(page.locator('h2')).toContainText('Übersicht');
  await moveHome(page, name);
}

/**
 * The registration puts a new home planet on a random position of galaxy 1,
 * where two tests could meet. The next free home slot of the home system of
 * the test's own area takes it over, and the page shows the new position.
 */
async function moveHome(page: Page, name: string): Promise<void> {
  seed({ name, moveHome: nextHome() });
  await page.reload();
  await expect(page.locator('h2')).toContainText('Übersicht');
}

export async function login(
  page: Page,
  name: string,
  password = 'ein-sicheres-testpasswort',
): Promise<void> {
  await page.goto('/');
  await page.fill('#a_name', name);
  await page.fill('#a_pw', password);
  await page.click('button[type=submit]');
  await expect(page.locator('h2')).toContainText('Übersicht');
}

/** The e-mail address the helpers give a player. */
export const emailOf = (name: string): string =>
  `${name.toLowerCase()}@example.org`;

/**
 * Registers on the mail server with the link of the invitation mail. The
 * server asks for a login afterwards: `loginByCode`.
 */
export async function registerByMail(
  page: Page,
  name: string,
  password = 'ein-sicheres-testpasswort',
): Promise<void> {
  mailCli('invite', emailOf(name));
  const [link] = await mail(emailOf(name), /^http:\S+#invite=[\w-]+$/m);
  await page.goto(link);
  await page.fill('#a_name', name);
  await page.fill('#a_pw', password);
  await page.click('button[type=submit]');
  await expect(page.locator('.toast').last()).toContainText(
    'Konto erstellt. Melde dich jetzt an.',
  );
}

/** Logs in on the mail server with the password and the code from the mail. */
export async function loginByCode(
  page: Page,
  name: string,
  password = 'ein-sicheres-testpasswort',
): Promise<void> {
  await page.goto(E2E_MAIL_URL);
  await page.fill('#a_name', name);
  await page.fill('#a_pw', password);
  await page.click('button[type=submit]');
  await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');
  const [, code] = await mail(emailOf(name), /Anmeldecode lautet (\d{6})\./);
  await page.getByLabel('Sechsstelliger Code aus deiner E-Mail').fill(code!);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.locator('h2')).toContainText('Übersicht');
}

/**
 * The shown place in the header with more than one own place, „name
 * [g:s:p]“: the entry of the list „Aktiver Planet“ that the rendered header
 * marks with the attribute `selected`. Header.svelte sets it from the
 * applied state (`headerLine()`), and a choice in the list does not (it only
 * changes which entry is checked), so it shows the planet only once
 * selectPlanet() of main.ts has fetched and applied its state. The header
 * names it only there, not again as text (#241).
 */
export const shownPlace = (page: Page): Locator =>
  page.getByLabel('Aktiver Planet').locator('option[selected]');

/**
 * Waits until the header shows the own place `name` (one of several) as the
 * active one: rendered from the applied state, and checked in the list.
 */
export async function expectShownPlace(
  page: Page,
  name: string,
): Promise<void> {
  const literal = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const label = new RegExp(`^${literal} \\[\\d+:\\d+:\\d+\\]$`);
  await expect(shownPlace(page)).toHaveText(label);
  await expect(
    page.getByLabel('Aktiver Planet').locator('option:checked'),
  ).toHaveText(label);
}

/** Selects an own planet by its name in the header. */
export async function choosePlanet(page: Page, name: string): Promise<void> {
  const selector = page.getByLabel('Aktiver Planet');
  const option = selector
    .locator('option')
    .filter({ hasText: new RegExp(`^${name} \\[`) });
  await selector.selectOption((await option.getAttribute('value'))!);
  await expectShownPlace(page, name);
}

/** The amount of a resource in the bar, as shown. */
export const stock = (page: Page, label: string) =>
  page.locator('#resbar .res').filter({ hasText: label }).locator('.v');

/** Views in the phone tab bar; the others are under „Mehr“ (issue #61). */
const TABS = ['overview', 'buildings', 'fleet', 'galaxy'];

/**
 * Opens a view: the side menu on a desktop, tab bar or „Mehr“ on a phone.
 * The layout follows the viewport width (the CSS breakpoint is 760 px), not
 * a snapshot of what is visible: right after a reload the menu may not be
 * drawn yet. Every click waits for its element.
 */
export async function nav(page: Page, view: string): Promise<void> {
  const phone = (page.viewportSize()?.width ?? 1280) <= 760;
  if (!phone) return page.click(`#menu [data-v=${view}]`);
  if (TABS.includes(view)) return page.click(`#tabbar [data-v=${view}]`);
  await page.click('#tabbar [data-act=moreOpen]');
  await page.click(`#more-list [data-v=${view}]`);
  await expect(page.locator('#more')).not.toBeVisible();
}

/**
 * Logs out: on a phone „Logout“ is at the top of the sheet „Mehr“ (#189), on
 * a desktop in the header.
 */
export async function logout(page: Page): Promise<void> {
  const phone = (page.viewportSize()?.width ?? 1280) <= 760;
  if (phone && (await page.locator('#tabbar').isVisible())) {
    await page.click('#tabbar [data-act=moreOpen]');
    return page.click('#more [data-act=logout]');
  }
  return page.click('[data-act=logout]');
}

/**
 * On a phone the lists of buildings, research, shipyard and defense show the
 * filter „Baubar“ and compact rows (#189): this chooses „Alle“ and unfolds
 * every row, so a test sees the locked entries and their details as on a
 * desktop. It does nothing on a desktop.
 */
export async function openAllRows(page: Page): Promise<void> {
  if ((page.viewportSize()?.width ?? 1280) > 760) return;
  await page
    .getByRole('group', { name: 'Filter' })
    .getByRole('button', { name: 'Alle', exact: true })
    .click();
  for (const fold of await page
    .getByRole('button', { name: /^Details zu / })
    .all())
    if ((await fold.getAttribute('aria-expanded')) === 'false')
      await fold.click();
}

/**
 * „Optionen“ is in sections on a phone (#189): this chooses one of „Spiel“,
 * „Runde“, „Konto“, „Gerät“ and „Weiteres“, so its boxes are in sight. It does
 * nothing on a desktop, which shows them all.
 */
export async function optionsSection(
  page: Page,
  section: 'Spiel' | 'Runde' | 'Konto' | 'Gerät' | 'Weiteres',
): Promise<void> {
  if ((page.viewportSize()?.width ?? 1280) > 760) return;
  await page
    .getByRole('group', { name: 'Bereich' })
    .getByRole('button', { name: section, exact: true })
    .click();
}

/** The row of a player's planet on the galaxy page. */
export const galaxyRow = (page: Page, player: string): Locator =>
  page.locator('tr').filter({
    has: page.locator('td', { hasText: new RegExp(`^${player} \\(Platz`) }),
  });

/**
 * The action of a row of the Sternenkarte: on a desktop in the row itself, on
 * a phone (#189) behind the „⋯“ of the row, which opens the bottom sheet with
 * the actions; this opens it (once) and returns the action in the sheet.
 */
export async function galaxyAction(
  page: Page,
  row: Locator,
  name: string | RegExp,
): Promise<Locator> {
  if ((page.viewportSize()?.width ?? 1280) > 760)
    return row.getByRole('button', { name }).or(row.getByText(name));
  const sheet = page.locator('dialog.gal-sheet');
  if (!(await sheet.isVisible()))
    await row.getByRole('button', { name: /^Aktionen für / }).click();
  await expect(sheet).toBeVisible();
  return sheet.getByRole('button', { name });
}

/**
 * The servers under test run without Web Push, which needs an HTTPS address.
 * The options show the push kinds only with it (#192), so this page gets the
 * answer a server with Web Push gives: the real policy with `webPush: true`.
 * Everything else, saving the kinds included, goes to the real server.
 */
export async function withWebPush(page: Page): Promise<void> {
  await page.route('**/api/account/policy', async (route) => {
    const response = await route.fetch();
    const policy = (await response.json()) as Record<string, unknown>;
    await route.fulfill({ response, json: { ...policy, webPush: true } });
  });
}

/** Seconds of a duration like "1h 02m 03s". */
export const seconds = (text: string): number =>
  [...text.matchAll(/(\d+)([Thms])/g)].reduce(
    (sum, [, n, unit]) =>
      sum + Number(n) * { T: 86400, h: 3600, m: 60, s: 1 }[unit!]!,
    0,
  );

export const lastToast = (page: Page): Locator => page.locator('.toast').last();

/**
 * The highscore lists every player of the run, and the table is as wide as
 * the largest number any test seeded. A test of the layout with numbers must
 * not depend on what other tests did, so its page gets the state with the
 * players of this test only; everything else is the real answer of the server
 * (#302).
 */
export async function onlyOwnPlayers(page: Page): Promise<void> {
  const mine = new Set(ownNames());
  await page.route('**/api/state**', async (route) => {
    const response = await route.fetch();
    const state = (await response.json()) as {
      players?: Record<string, { name: string }>;
    };
    const players = Object.fromEntries(
      Object.entries(state.players ?? {}).filter(([, p]) => mine.has(p.name)),
    );
    await route.fulfill({ response, json: { ...state, players } });
  });
}

/** The planet slots each player's poll renders took, so the next one takes a free slot. */
const pollSlots = new Map<string, Set<number>>();

/**
 * A render by the poll that is not fresh (#361): a new colony of `name` on a
 * free slot of its home system, which the header then offers in the choice of
 * the planet. The header and the view are drawn by the same `render()` pass,
 * so when the header shows the colony, the view has the new state too. A view
 * kept over such a render keeps its nodes, so a test cannot learn of it from
 * a replaced node.
 */
export async function pollRender(page: Page, name: string): Promise<void> {
  let used = pollSlots.get(name);
  if (!used) {
    const text = (await page.locator('#pinfo').textContent()) ?? '';
    used = new Set([Number(/\[\d+:\d+:(\d+)\]/.exec(text)![1])]);
    pollSlots.set(name, used);
  }
  let slot = 9;
  while (used.has(slot)) slot++;
  used.add(slot);
  const options = page.locator('#planet_select option');
  const before = await options.count();
  seed({ name, colony: { p: slot, name: uniqueName('Zwischen') } });
  await expect(options).toHaveCount(Math.max(before, 1) + 1, {
    timeout: 15000,
  });
}
