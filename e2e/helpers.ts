import { execFileSync } from 'node:child_process';
import { expect, type Page } from '@playwright/test';
import { E2E_ENV } from './env.ts';

const run = (script: string, args: string[]): string =>
  execFileSync(process.execPath, [script, ...args], {
    env: { ...process.env, ...E2E_ENV },
    encoding: 'utf8',
  });

/** The operator command `nova …` against the server under test. */
export const cli = (...args: string[]): string =>
  run('src/server/cli.ts', args);

export const seed = (data: object): string =>
  run('e2e/seed.ts', [JSON.stringify(data)]);

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

let count = 0;
export const uniqueName = (base: string): string =>
  `${base}${++count}${Date.now() % 1000}`.slice(0, 20);

export async function register(
  page: Page,
  name: string,
  password = 'ein-sicheres-testpasswort',
): Promise<void> {
  const email = `${name.toLowerCase()}@example.org`;
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

/** Opens a view: the side menu on a desktop, tab bar or „Mehr“ on a phone. */
export async function nav(page: Page, view: string): Promise<void> {
  const side = page.locator(`#menu [data-v=${view}]`);
  if (await side.isVisible()) return side.click();
  const tab = page.locator(`#tabbar [data-v=${view}]`);
  if (await tab.isVisible()) return tab.click();
  await page.click('#tabbar [data-act=moreOpen]');
  await page.click(`#more-list [data-v=${view}]`);
  await expect(page.locator('#more')).not.toBeVisible();
}
