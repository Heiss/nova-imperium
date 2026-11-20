// The Origin check and the limit per account (#328, okf/security/review.md): a
// POST must be JSON and come from the address of the game (`Origin`), and a POST
// without `Origin` is refused like one from a foreign address (owner,
// 2026-11-19): a browser sends the header on every fetch, so only a script
// outside the page leaves it out. Playwright's `APIRequestContext` is such a
// script. GET is not checked. Game actions and play time reports share one
// limit of 120 per account and minute. The unit tests of
// src/server/http/app.test.ts cover the rules with a fake request; this goes
// through the real server and a real browser.
import { expect, test } from '@playwright/test';
import { register, uniqueName, watch } from './helpers.ts';

test.describe('the Origin check (#328)', () => {
  test('a POST without Origin, with a foreign one or without JSON is refused; the page itself is not', async ({
    page,
    request,
  }) => {
    const w = watch(page);
    const name = uniqueName('Herkunft');
    await register(page, name);
    const origin = new URL(page.url()).origin;
    const rename = { type: 'rename', name: 'Gekapert' };

    // The script has the session of the player (it shares the cookies), and
    // still: no Origin, no action.
    const noOrigin = await page.request.post('/api/action', { data: rename });
    expect(noOrigin.status()).toBe(403);
    // A foreign Origin is refused the same way, even with the right session.
    const foreign = await page.request.post('/api/action', {
      data: rename,
      headers: { origin: 'https://angreifer.example' },
    });
    expect(foreign.status()).toBe(403);
    // So is a form post with the right Origin: JSON only.
    const form = await page.request.post('/api/action', {
      form: { type: 'rename', name: 'Gekapert' },
      headers: { origin },
    });
    expect(form.status()).toBe(403);
    // Nothing changed.
    await page.reload();
    await expect(page.locator('#pinfo')).not.toContainText('Gekapert');

    // A request without a session: refused before it asks who sends it.
    expect(
      (
        await request.post('/api/login', { data: { name, password: 'x' } })
      ).status(),
    ).toBe(403);

    // With the right Origin the same request is judged by the game: here the
    // session and the name make it go through.
    const own = await page.request.post('/api/action', {
      data: { type: 'rename', name: 'Neuname' },
      headers: { origin },
    });
    expect(own.status()).toBe(200);
    await page.reload();
    await expect(page.locator('#pinfo')).toContainText('Neuname');

    // GET is not checked: no Origin needed to read.
    expect((await request.get('/healthz')).status()).toBe(200);
    expect(w.problems).toEqual([]);
  });
});

test.describe('the limit of actions per account (#328)', () => {
  test('an account that sends more than 120 actions in a minute is refused and another one is not', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    const first = uniqueName('Vielschreiber');
    const second = uniqueName('Ruhiger');
    await register(page, first);
    const other = await browser.newPage({ viewport: page.viewportSize() });
    await register(other, second);

    // The window of an account is fixed and starts with its first action;
    // the limit is reached within 121 more, whichever the count so far.
    const outcome = await page.evaluate(async () => {
      const post = () =>
        fetch('/api/action', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'read' }),
        });
      for (let sent = 1; sent <= 250; sent++) {
        const response = await post();
        if (response.status !== 200)
          return {
            sent,
            status: response.status,
            error: ((await response.json()) as { error?: string }).error,
          };
      }
      return null;
    });
    expect(outcome).not.toBeNull();
    expect(outcome!.status).toBe(400);
    expect(outcome!.error).toContain('Zu viele Aktionen');
    expect(outcome!.sent).toBeLessThanOrEqual(121);

    // Another account has its own count.
    const fine = await other.evaluate(async () => {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'read' }),
      });
      return response.status;
    });
    expect(fine).toBe(200);
    await other.close();
  });
});
