// The buddy list (#227, okf/features/buddy-list.md): a player asks another
// for a friendship by name („Freundschaft anfragen“), the other sees the
// request with the mark on „Freunde“, refuses it, accepts the next one, and
// both see each other with the planet link and online; refused actions
// (oneself, an unknown name, a duplicate and a crossed request, an answer
// to no request) show their message; „Freundschaft beenden“ ends it for
// both. Desktop and phone, with axe on „Freunde“.
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

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const lastToast = (page: Page): Locator => page.locator('.toast').last();

/** Types a name into „Freundschaft anfragen“ and sends it. */
async function ask(page: Page, name: string): Promise<void> {
  await page.getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Freundschaft anfragen' }).click();
}

/** The paragraph of a request of `name`. */
const request = (page: Page, name: string): Locator =>
  page.locator('#view p').filter({ hasText: name });

/** An action as from a page that still shows an old list. */
const refusal = (page: Page, body: object): Promise<string | undefined> =>
  page.evaluate(async (data) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    return ((await r.json()) as { error?: string }).error;
  }, body);

async function friendsFlow(page: Page, browser: Browser): Promise<void> {
  const { problems } = watch(page);
  const anna = uniqueName('Freundin');
  const bert = uniqueName('Kumpel');
  await register(page, anna);
  // Its own context, which axe needs, at the size of the first page.
  const context = await browser.newContext({
    baseURL: new URL(page.url()).origin,
    viewport: page.viewportSize(),
  });
  const other = await context.newPage();
  const otherProblems = watch(other).problems;
  await register(other, bert);

  await nav(page, 'friends');
  await expect(page.getByRole('heading', { name: 'Freunde' })).toBeVisible();
  await expect(page.getByText('Du hast noch keine Freunde.')).toBeVisible();
  await expect(page.getByText('Keine offenen Anfragen.')).toBeVisible();
  expect(await violations(page)).toEqual([]);

  // Refused: oneself, an unknown name.
  await ask(page, anna);
  await expect(lastToast(page)).toContainText('Das bist du selbst.');
  await ask(page, uniqueName('Niemand'));
  await expect(lastToast(page)).toContainText('Spieler nicht gefunden.');

  await ask(page, bert);
  await expect(lastToast(page)).toContainText('Anfrage gesendet.');
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('');
  await expect(request(page, bert)).toContainText(bert);
  await expect(
    request(page, bert).getByRole('button', { name: 'Anfrage zurückziehen' }),
  ).toBeVisible();
  // A duplicate changes nothing.
  await ask(page, bert);
  await expect(lastToast(page)).toContainText(
    'Deine Anfrage ist bereits offen.',
  );

  // Bert sees the request, with the mark on „Freunde“.
  await other.reload();
  await expect(
    other.locator(
      '[data-v=friends] .badge[aria-label="Offene Freundschaftsanfragen"]',
    ),
  ).not.toHaveCount(0);
  await nav(other, 'friends');
  // A crossed request is refused.
  await ask(other, anna);
  await expect(lastToast(other)).toContainText(
    `${anna} hat dir bereits eine Anfrage geschickt.`,
  );
  expect(await violations(other)).toEqual([]);
  await request(other, anna).getByRole('button', { name: 'Ablehnen' }).click();
  await expect(lastToast(other)).toContainText('Anfrage abgelehnt.');
  await expect(other.getByText('Keine offenen Anfragen.')).toBeVisible();

  // Asked again, and accepted.
  await page.reload();
  await expect(page.locator('#view')).not.toContainText(bert);
  await ask(page, bert);
  await expect(lastToast(page)).toContainText('Anfrage gesendet.');
  await other.reload();
  const accept = request(other, anna).getByRole('button', { name: 'Annehmen' });
  const annaId = await accept.getAttribute('data-uid');
  await accept.click();
  await expect(lastToast(other)).toContainText('Anfrage angenommen.');
  // A second answer, as from an old page, finds no request.
  expect(
    await refusal(other, { type: 'answerFriend', uid: annaId, accept: true }),
  ).toBe('Diese Anfrage gibt es nicht.');

  const row = other.locator('#view tr').filter({ hasText: anna });
  await expect(row).toContainText('online');
  await expect(row.locator('[data-act=gto]')).toHaveText(/^\[\d+:\d+:\d+\]$/);
  expect(await violations(other)).toEqual([]);

  await page.reload();
  const bertRow = page.locator('#view tr').filter({ hasText: bert });
  await expect(bertRow).toBeVisible();
  // The list is no wider than the screen, on a phone too (#189).
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  const target = await bertRow.locator('[data-act=gto]').innerText();
  const [, g, s] = /\[(\d+):(\d+):\d+\]/.exec(target)!;
  expect(await violations(page)).toEqual([]);
  expect(
    await refusal(page, { type: 'answerFriend', uid: 'u_none', accept: true }),
  ).toBe('Spieler nicht gefunden.');

  // The planet link opens the friend's system on the Sternenkarte.
  await bertRow.locator('[data-act=gto]').click();
  await expect(page.locator('#g_g')).toHaveValue(g!);
  await expect(page.locator('#g_s')).toHaveValue(s!);

  // Ending the friendship asks first, then both lose it.
  await nav(page, 'friends');
  page.once('dialog', (d) => void d.accept());
  await bertRow.getByRole('button', { name: 'Freundschaft beenden' }).click();
  await expect(lastToast(page)).toContainText('Freundschaft beendet.');
  await expect(page.getByText('Du hast noch keine Freunde.')).toBeVisible();
  await other.reload();
  await expect(other.getByText('Du hast noch keine Freunde.')).toBeVisible();

  await context.close();
  expect(problems).toEqual([]);
  expect(otherProblems).toEqual([]);
}

test('friends ask, refuse, accept, see each other and end the friendship', async ({
  page,
  browser,
}) => {
  await friendsFlow(page, browser);
});

test('the buddy list on a phone @phone', async ({ page, browser }) => {
  await friendsFlow(page, browser);
});
