import { execFileSync } from 'node:child_process';
import { randomInt } from 'node:crypto';
import { expect, type Locator, type Page } from '@playwright/test';
import { E2E_ENV, E2E_MAILBOX, E2E_MAIL_ENV, E2E_MAIL_URL } from './env.ts';
import { mailsTo } from './mail.ts';

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

export const seed = (data: object): string =>
  run('e2e/seed.ts', [JSON.stringify(data)]);

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
 * A player name no other test uses: the base (at most 14 characters) and 6
 * random base-36 characters, at most 20 in all. A counter and the clock
 * repeated across Playwright workers, which each start the counter anew
 * (#68: a repeat run invited an address that already existed).
 */
export const uniqueName = (base: string): string =>
  `${base.slice(0, 14)}${randomInt(36 ** 6)
    .toString(36)
    .padStart(6, '0')}`;

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

/** Selects an own planet by its name in the header. */
export async function choosePlanet(page: Page, name: string): Promise<void> {
  const selector = page.getByLabel('Aktiver Planet');
  const option = selector
    .locator('option')
    .filter({ hasText: new RegExp(`^${name} \\[`) });
  await selector.selectOption((await option.getAttribute('value'))!);
  await expect(page.locator('#pinfo b').first()).toHaveText(name);
}

/** The amount of a resource in the bar, as shown. */
export const stock = (page: Page, label: string) =>
  page.locator('#resbar .res').filter({ hasText: label }).locator('.v');

/** Views in the phone tab bar; the others are under „Mehr“ (issue #61). */
const TABS = ['overview', 'buildings', 'fleet', 'messages'];

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

/** The row of a player's planet on the galaxy page. */
export const galaxyRow = (page: Page, player: string): Locator =>
  page.locator('tr').filter({
    has: page.locator('td', { hasText: new RegExp(`^${player} \\(Platz`) }),
  });

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
