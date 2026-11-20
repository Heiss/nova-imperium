// The list „Schnellwahl“ of the fleet form holds more than the own places
// (#292, owner 2026-11-17): the main planet of each friend („Freund: …“), of
// each guild member („Gilde: …“) and the last hostile targets („Ziel: Spieler
// – Planet [g:s:p]“), in one flat list in this order. A player who is both a
// friend and a guild member is listed once, as the friend. Choosing an entry
// enters its coordinates and the list of missions follows (#253). On a phone
// the form fits 360 px, and axe finds nothing.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { guildTag, nav, register, seed, uniqueName, watch } from './helpers.ts';

/** A second player in a page of its own context, at the size of `like`. */
async function player(
  browser: Browser,
  like: Page,
  name: string,
): Promise<{ page: Page; place: string; problems: string[] }> {
  const page = await (
    await browser.newContext({ viewport: like.viewportSize() })
  ).newPage();
  const { problems } = watch(page);
  await register(page, name);
  const header = (await page.locator('#pinfo').textContent())!;
  return { page, place: /\[\d+:\d+:\d+\]/.exec(header)![0], problems };
}

async function quickFlow(page: Page, browser: Browser): Promise<void> {
  // Five registrations of a second or so each (#302).
  test.slow();
  const phone = (page.viewportSize()?.width ?? 1280) <= 760;
  const w = watch(page);
  const me = uniqueName('Schnell');
  const friend = uniqueName('Freund');
  const mate = uniqueName('Gildling');
  const prey = uniqueName('Beute');
  const tag = guildTag('SQ');
  const title = `[${tag}] Wahl ${tag}`;
  await register(page, me);
  // A colony, so an own place comes first; a probe for the Auspex-Erkundung.
  seed({
    name: me,
    colony: { name: 'Aussenposten' },
    ships: { probe: 2 },
    research: { spy: 4 },
    res: { m: 0, c: 0, d: 10000 },
  });
  const f = await player(browser, page, friend);
  const g = await player(browser, page, mate);
  const t = await player(browser, page, prey);
  // Mines give the other players points, so none is under the protection of
  // the newcomers (as in e2e/incoming-fleets.spec.ts).
  for (const name of [me, prey])
    seed({ name, b: { metal: 12, crystal: 10, solar: 12 } });

  // The friend: asked and accepted; the guild: founded, two apply, both join.
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
    .filter({ hasText: me })
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(f.page.locator('.toast').last()).toContainText(
    'Anfrage angenommen.',
  );
  await nav(page, 'guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(`Wahl ${tag}`);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  for (const other of [f.page, g.page]) {
    await nav(other, 'guilds');
    await other.getByRole('link', { name: title }).click();
    await other.getByRole('button', { name: 'Bewerben' }).click();
    await expect(other.locator('.toast').last()).toContainText(
      'Bewerbung gesendet.',
    );
  }
  await page.reload();
  for (const name of [friend, mate]) {
    await page
      .locator('p', { hasText: name })
      .getByRole('button', { name: 'Annehmen' })
      .click();
    await expect(page.locator('.toast').last()).toContainText(
      'Bewerbung angenommen.',
    );
  }

  // The last target: an Auspex-Erkundung of the prey.
  await nav(page, 'fleet');
  const [, tg, ts, tp] = /\[(\d+):(\d+):(\d+)\]/.exec(t.place)!;
  await page.locator('#t_g').fill(tg!);
  await page.locator('#t_s').fill(ts!);
  await page.locator('#t_p').fill(tp!);
  await page.getByLabel('Anzahl Spähschädel').fill('1');
  await expect(page.getByLabel('Auftrag')).toHaveValue('attack');
  await page.getByLabel('Auftrag').selectOption('spy');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Flotte unterwegs nach',
  );

  // The list: own places, friends, guild members, last targets; the friend
  // who is also in the guild once, as the friend.
  await page.reload();
  const quick = page.getByLabel('Schnellwahl');
  await expect(quick.locator('option')).toHaveText([
    '– wählen –',
    new RegExp(`^Aussenposten \\[\\d+:\\d+:\\d+\\]$`),
    `Freund: ${friend} ${f.place}`,
    `Gilde: ${mate} ${g.place}`,
    `Ziel: ${prey} – Heimatplanet ${t.place}`,
  ]);

  // An entry enters its coordinates, and the mission list follows.
  await quick.selectOption({ label: `Freund: ${friend} ${f.place}` });
  const [, gg, ss, pp] = /\[(\d+):(\d+):(\d+)\]/.exec(f.place)!;
  await expect(page.locator('#t_g')).toHaveValue(gg!);
  await expect(page.locator('#t_s')).toHaveValue(ss!);
  await expect(page.locator('#t_p')).toHaveValue(pp!);
  await expect(page.locator('#t_info')).toContainText(friend);
  const missions = await page
    .getByLabel('Auftrag')
    .locator('option')
    .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  expect(missions).toEqual(expect.arrayContaining(['attack', 'spy']));
  await quick.selectOption({
    label: `Ziel: ${prey} – Heimatplanet ${t.place}`,
  });
  await expect(page.locator('#t_info')).toContainText(prey);

  if (phone) {
    // The longest entry fits the 360 px phone, and axe finds nothing.
    await page.setViewportSize({ width: 360, height: 800 });
    const wide = await page.evaluate(() => {
      const client = document.documentElement.clientWidth;
      return {
        over: document.documentElement.scrollWidth - client,
        // What reaches furthest, to name it when the page is too wide.
        by: [...document.querySelectorAll('#view *')]
          .map((el) => ({
            el: `${el.tagName.toLowerCase()}#${el.id}.${el.className}`,
            right: Math.round(el.getBoundingClientRect().right),
          }))
          .filter((x) => x.right > client)
          .sort((x, y) => y.right - x.right)
          .slice(0, 3),
      };
    });
    expect(wide.over, JSON.stringify(wide.by)).toBeLessThanOrEqual(1);
  }
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  expect([...w.problems, ...f.problems, ...g.problems, ...t.problems]).toEqual(
    [],
  );
}

test.describe('the Schnellwahl with friends, guild members and last targets (#292)', () => {
  test('lists the own places, the friends, the guild members and the last targets, and enters the choice', async ({
    page,
    browser,
  }) => {
    await quickFlow(page, browser);
  });

  test('lists the own places, the friends, the guild members and the last targets, and fits a phone @phone', async ({
    page,
    browser,
  }) => {
    await quickFlow(page, browser);
  });
});
