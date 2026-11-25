// A feature switched off for the round is hidden, not shown as closed
// (#404; owner, 2026-11-25, 112a to 114a). The admin switches the
// marketplace off in „Universum“: a player who has it open falls back to the
// overview at the next state, and neither the player nor the admin sees
// „Marktplatz“ in the menu or under „Mehr“; `?view=market` opens the
// overview; the page „Marktplatz“ of the Lexicanum is not listed or found
// and its address opens the start page of the Lexicanum. Switched on again,
// everything is back. Desktop and phone. The market is shared by all players
// of the universe; the tests run one after another (one worker) and put the
// setting back.
import { type Browser, expect, test, type Page } from '@playwright/test';
import { cli, nav, register, uniqueName, watch } from './helpers.ts';

const lastToast = (page: Page) => page.locator('.toast').last();

/** The admin sets „Marktplatz aktiv“ in „Universum“ and saves. */
async function switchMarket(admin: Page, on: '0' | '1'): Promise<void> {
  await nav(admin, 'admin');
  await admin.getByRole('tab', { name: 'Universum' }).click();
  // The switch stays in „Universum“ (114a).
  await admin.getByLabel('Marktplatz aktiv', { exact: true }).selectOption(on);
  await admin.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(lastToast(admin)).toContainText('Einstellungen gespeichert.');
}

/** Loads the state now, as the tab does when it comes back. */
const nextState = (page: Page): Promise<void> =>
  page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });

/** Whether the navigation (the menu, the tab bar and „Mehr“) names „Marktplatz“. */
async function expectMarketEntry(page: Page, shown: boolean): Promise<void> {
  // The menu and „Mehr“ are both in the page; the width shows one of them.
  const entries = page.locator(
    '#menu [data-v=market], #more-list [data-v=market]',
  );
  if (shown) await expect(entries).toHaveCount(2);
  else await expect(entries).toHaveCount(0);
  for (const place of ['#menu', '#tabbar', '#more-list']) {
    const nav = page.locator(place);
    if (shown && place !== '#tabbar')
      await expect(nav).toContainText('Marktplatz');
    else await expect(nav).not.toContainText('Marktplatz');
  }
}

/** The page „Marktplatz“ of the Lexicanum: listed, found and reached, or none of it. */
async function expectMarketPage(page: Page, shown: boolean): Promise<void> {
  const count = shown ? 1 : 0;
  await page.goto('/?view=lexicanum');
  await expect(page.locator('#view h2')).toHaveText('Lexicanum');
  const link = page.locator('#view [data-act=lex][data-a=rule-market]');
  await expect(link).toHaveCount(count);
  // The search finds the page only while it is shown.
  await page
    .getByRole('combobox', { name: 'Suche im Lexicanum' })
    .fill('Marktplatz');
  await expect(
    page.locator('#lx-results .lx-r b', { hasText: /^Marktplatz$/ }),
  ).toHaveCount(count);
  await page.goto('/?view=lexicanum&a=list-rule');
  await expect(page.locator('#view .lx-list')).toBeVisible();
  await expect(link).toHaveCount(count);
  // Its address: the article, or the start page as for an unknown article.
  await page.goto('/?view=lexicanum&a=rule-market');
  if (shown)
    await expect(page.locator('#view .lx-title')).toContainText('Marktplatz');
  else {
    await expect(page.locator('#view .lx-title')).toHaveCount(0);
    await expect(
      page.locator('#view .lx-crumb [aria-current=page]'),
    ).toHaveText('Lexicanum');
    await expect(
      page.getByRole('heading', { name: 'Nachschlagen' }),
    ).toBeVisible();
  }
}

async function hideFlow(page: Page, browser: Browser): Promise<void> {
  const w = watch(page);
  const admin = uniqueName('Schaltwart');
  await register(page, admin);
  cli('admin', admin);
  await page.reload();
  const context = await browser.newContext({ viewport: page.viewportSize() });
  const player = await context.newPage();
  const p = watch(player);
  try {
    await register(player, uniqueName('Haendlerin'));
    // As today: the market is in the menu and its view opens.
    await expectMarketEntry(player, true);
    await nav(player, 'market');
    await expect(player.locator('h2')).toContainText('Marktplatz');

    await switchMarket(page, '0');
    // The open view falls back to the overview at the next state.
    await nextState(player);
    await expect(player.locator('h2')).toContainText('Übersicht');
    await expect(player).toHaveURL(/[?&]view=overview$/);
    // The player and the admin alike (114a).
    for (const who of [player, page]) {
      await who.goto('/?view=market');
      await expect(who.locator('h2')).toContainText('Übersicht');
      await expectMarketEntry(who, false);
      await expectMarketPage(who, false);
    }
  } finally {
    await switchMarket(page, '1');
  }
  // Switched on again: everything is back.
  for (const who of [player, page]) {
    await who.goto('/?view=market');
    await expect(who.locator('h2')).toContainText('Marktplatz');
    await expectMarketEntry(who, true);
    await expectMarketPage(who, true);
  }
  cli('unadmin', admin);
  await context.close();
  expect(w.problems).toEqual([]);
  expect(p.problems).toEqual([]);
}

test('a marketplace switched off is hidden for the players and the admin (#404)', async ({
  page,
  browser,
}) => {
  await hideFlow(page, browser);
});

test('a marketplace switched off is hidden on a phone (#404) @phone', async ({
  page,
  browser,
}) => {
  await hideFlow(page, browser);
});
