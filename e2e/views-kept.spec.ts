// What the views relied on while they were mounted anew on every render
// (#361), kept now that a render that is not fresh keeps them: the focus
// stays in the field it was in, the clock still counts the countdowns of the
// fleet, and the chat of a guild keeps its place. Each passed before the
// change and passes after it; the renders are told by `pollRender` of
// helpers.ts.
import { expect, test, type Page } from '@playwright/test';
import { sendTransport } from './fleet-helpers.ts';
import {
  cli,
  guildTag,
  nav,
  pollRender,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

/** A game action sent by hand. */
const action = (page: Page, data: object): Promise<string | undefined> =>
  page.evaluate(async (body) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return ((await r.json()) as { error?: string }).error;
  }, data);

for (const tag of ['', ' @phone']) {
  test.describe(`what the views kept over a render (#361)${tag}`, () => {
    test('the focus stays in the field of every view over a poll render', async ({
      page,
    }) => {
      const w = watch(page);
      const name = uniqueName('FokusAlle');
      await register(page, name);
      expect(cli('admin', name)).toContain(`${name} is now admin.`);
      seed({
        name,
        b: { market: 1, robot: 4 },
        ships: { probe: 1 },
        marketReset: true,
      });
      await page.reload();
      const cases: [string, string, (() => Promise<void>)?][] = [
        ['fleet', '#t_g'],
        ['market', '#market-amount'],
        ['friends', '#friend_name'],
        ['achievements', '#achievement_search'],
        ['guilds', '#guild_tag'],
        [
          'admin',
          '#inv_email',
          () => page.getByRole('tab', { name: 'Einladungen' }).click(),
        ],
      ];
      for (const [view, field, open] of cases) {
        await nav(page, view);
        await open?.();
        await page.locator(field).focus();
        await pollRender(page, name);
        await expect(page.locator(field), view).toBeFocused();
      }
      expect(w.problems).toEqual([]);
    });

    test('the clock still counts the countdown of a fleet over a poll render', async ({
      page,
    }) => {
      const w = watch(page);
      const name = uniqueName('UhrFlotte');
      await register(page, name);
      seed({
        name,
        ships: { sc: 1 },
        res: { m: 5000, c: 0, d: 5000 },
        colony: {},
      });
      await sendTransport(page);
      const left = page
        .locator('tr', { has: page.locator('.fl-transport') })
        .locator('.cd')
        .first();
      await expect(left).toBeVisible();
      await pollRender(page, name);
      const shown = await left.textContent();
      await expect(left).not.toHaveText(shown!);
      await expect(left).toHaveText(/^(\d+h )?(\d+m )?\d{2}s$/);
      expect(w.problems).toEqual([]);
    });

    test('the chat of a guild keeps its place over a poll render', async ({
      page,
    }) => {
      const w = watch(page);
      const name = uniqueName('ChatPlatz');
      await register(page, name);
      await nav(page, 'guilds');
      const tag = guildTag('P');
      await page.getByLabel('Kürzel').fill(tag);
      await page.getByLabel('Name', { exact: true }).fill(`Platz ${tag}`);
      await page.getByRole('button', { name: 'Gilde gründen' }).click();
      await expect(
        page.getByRole('heading', { name: `[${tag}] Platz ${tag}` }),
      ).toBeVisible();
      for (let i = 0; i < 6; i++) {
        await expect
          .poll(() =>
            action(page, {
              type: 'sendGuildChat',
              text: `Nachricht ${i}: ${'Wort '.repeat(60)}`,
            }),
          )
          .toBeUndefined();
      }
      const log = page.locator('.chat-log');
      await expect(log.locator('li')).toHaveCount(6, { timeout: 15000 });
      const middle = await log.evaluate((el) => {
        el.scrollTop = Math.floor((el.scrollHeight - el.clientHeight) / 2);
        return el.scrollTop;
      });
      expect(middle).toBeGreaterThan(0);
      await pollRender(page, name);
      expect(await log.evaluate((el) => el.scrollTop)).toBe(middle);
      expect(w.problems).toEqual([]);
    });
  });
}
