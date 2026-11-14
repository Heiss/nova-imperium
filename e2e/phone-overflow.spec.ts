import { expect, test, type Page } from '@playwright/test';
import { cli, register, seed, uniqueName, watch } from './helpers.ts';
import { ADMIN_TABS } from '../src/client/views/misc.ts';

// No view is wider than a small phone (#189, D7): at 360 px the page must not
// scroll sideways. The resources page was 588 px wide on a 390 px phone, the
// highscore 415 px with names of 20 characters.

/** Every view of the navigation, in its order; the admin's tabs below. */
const VIEWS = [
  'overview',
  'buildings',
  'resources',
  'research',
  'shipyard',
  'defense',
  'fleet',
  'galaxy',
  'messages',
  'highscore',
  'guilds',
  'achievements',
  'news',
  'help',
  'admin',
];

/** How far the page reaches past the screen, with a pixel for rounding. */
async function overflow(page: Page, label: string): Promise<string[]> {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  return scroll > client + 1 ? [`${label}: ${scroll} px > ${client} px`] : [];
}

test('no view is wider than a 360 px phone (#189) @phone', async ({ page }) => {
  const w = watch(page);
  // The longest name a player may have (20 characters), as on the highscore.
  const name = uniqueName('Schmalbildschi');
  await register(page, name);
  cli('admin', name);
  // Every kind of producer, a throttled one with its note, and large numbers:
  // the longest rows the resources page has.
  seed({
    name,
    b: { metal: 30, crystal: 28, deut: 5, solar: 30, fusion: 8 },
    ships: { sat: 1200 },
    research: { energy: 3 },
    temp: 20,
    res: { m: 9000000, c: 9000000, d: 0 },
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  await expect(page.locator('h2')).toContainText('Übersicht');
  const found: string[] = [];
  // By the address, so a view that overflows does not hide the next ones:
  // a too wide page covers the tab bar's „Mehr“.
  for (const view of VIEWS) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator('#menu a.on')).toHaveAttribute('data-v', view);
    await page.waitForLoadState('networkidle');
    found.push(...(await overflow(page, view)));
  }
  for (const [tab, label] of Object.entries(ADMIN_TABS)) {
    await page.click(`[data-act=adminTab][data-tab=${tab}]`);
    await expect(page.getByRole('tab', { name: label })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The tables of the admin load after the click.
    await page.waitForLoadState('networkidle');
    found.push(...(await overflow(page, `admin ${tab}`)));
  }
  expect(found).toEqual([]);
  // On the narrow resources page the note of a throttled producer and the
  // shares stay usable.
  await page.goto('/?view=resources');
  const fusion = page.locator('tr', { hasText: 'Fusionssanktum (Stufe 8)' });
  await expect(fusion).toContainText('gedrosselt auf 58 %');
  const share = page.locator('select[data-k=metal]');
  await expect(share).toBeInViewport();
  await share.selectOption('50');
  await expect(share).toHaveValue('50');
  await page.reload();
  await expect(share).toHaveValue('50');
  expect(await overflow(page, 'resources')).toEqual([]);
  expect(w.problems).toEqual([]);
});
