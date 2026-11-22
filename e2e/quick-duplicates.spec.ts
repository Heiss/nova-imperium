// A place is listed once in the „Schnellwahl“ of the fleet form (#362): a
// player who sends a probe to the main planet of a friend, or of a guild
// member, had that place twice in the list (as „Freund“ or „Gilde“ and as
// „Ziel“), and the keyed list of the fleet page threw `each_key_duplicate`
// (live on 26.11.24): the view did not finish drawing. The place stands
// under the first group that has it: friend, then guild, then last target.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { guildTag, nav, register, seed, uniqueName, watch } from './helpers.ts';

/** A second player in a page of its own context, and the coordinates of its home planet. */
async function other(
  browser: Browser,
  like: Page,
  name: string,
): Promise<{ page: Page; at: string[] }> {
  const page = await (
    await browser.newContext({ viewport: like.viewportSize() })
  ).newPage();
  await register(page, name);
  const header = (await page.locator('#pinfo').textContent())!;
  return { page, at: /\[(\d+):(\d+):(\d+)\]/.exec(header)!.slice(1) };
}

/** Sends one Spähschädel to `at` and opens „Flotte“ again. */
async function spy(page: Page, at: string[]): Promise<void> {
  await nav(page, 'fleet');
  await page.locator('#t_g').fill(at[0]!);
  await page.locator('#t_s').fill(at[1]!);
  await page.locator('#t_p').fill(at[2]!);
  await page.getByLabel('Anzahl Spähschädel').fill('1');
  await page.getByLabel('Auftrag').selectOption('spy');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Flotte unterwegs nach',
  );
  await page.reload();
  await nav(page, 'fleet');
}

/** The entries of the „Schnellwahl“ that name `who`. */
const entries = (page: Page, who: string) =>
  page.getByLabel('Schnellwahl').locator('option', { hasText: who });

async function me(page: Page): Promise<string> {
  const name = uniqueName('Doppelt');
  await register(page, name);
  seed({
    name,
    ships: { probe: 3 },
    research: { spy: 4 },
    res: { m: 0, c: 0, d: 10000 },
    b: { metal: 12, crystal: 10, solar: 12 },
  });
  await page.reload();
  return name;
}

for (const tag of ['', ' @phone']) {
  test.describe(`a place once in the „Schnellwahl“ (#362)${tag}`, () => {
    test('the main planet of a friend that was spied on', async ({
      page,
      browser,
    }) => {
      const w = watch(page);
      const mine = await me(page);
      const friend = uniqueName('Kumpel');
      const f = await other(browser, page, friend);
      seed({ name: friend, b: { metal: 12, crystal: 10, solar: 12 } });
      await nav(page, 'friends');
      await page.getByLabel('Name', { exact: true }).fill(friend);
      await page.getByRole('button', { name: 'Freundschaft anfragen' }).click();
      await expect(page.locator('.toast').last()).toContainText(
        'Anfrage gesendet.',
      );
      await f.page.reload();
      await nav(f.page, 'friends');
      await f.page
        .locator('#view p')
        .filter({ hasText: mine })
        .getByRole('button', { name: 'Annehmen' })
        .click();
      await expect(f.page.locator('.toast').last()).toContainText(
        'Anfrage angenommen.',
      );
      await spy(page, f.at);
      await expect(page.getByLabel('Schnellwahl')).toBeVisible();
      await expect(entries(page, friend)).toHaveText([
        `Freund: ${friend} [${f.at.join(':')}]`,
      ]);
      expect(w.problems).toEqual([]);
    });

    test('the main planet of a guild member that was spied on', async ({
      page,
      browser,
    }) => {
      const w = watch(page);
      await me(page);
      const mate = uniqueName('Gildner');
      const g = await other(browser, page, mate);
      seed({ name: mate, b: { metal: 12, crystal: 10, solar: 12 } });
      const gtag = guildTag('DQ');
      const title = `[${gtag}] Doppel ${gtag}`;
      await nav(page, 'guilds');
      await page.getByLabel('Kürzel').fill(gtag);
      await page.getByLabel('Name', { exact: true }).fill(`Doppel ${gtag}`);
      await page.getByRole('button', { name: 'Gilde gründen' }).click();
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await nav(g.page, 'guilds');
      await g.page.getByRole('link', { name: title }).click();
      await g.page.getByRole('button', { name: 'Bewerben' }).click();
      await expect(g.page.locator('.toast').last()).toContainText(
        'Bewerbung gesendet.',
      );
      await page.reload();
      await page
        .locator('p', { hasText: mate })
        .getByRole('button', { name: 'Annehmen' })
        .click();
      await expect(page.locator('.toast').last()).toContainText(
        'Bewerbung angenommen.',
      );
      await spy(page, g.at);
      await expect(page.getByLabel('Schnellwahl')).toBeVisible();
      await expect(entries(page, mate)).toHaveText([
        `Gilde: ${mate} [${g.at.join(':')}]`,
      ]);
      expect(w.problems).toEqual([]);
    });
  });
}
