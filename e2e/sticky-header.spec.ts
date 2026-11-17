import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { nav, register, uniqueName, watch } from './helpers.ts';

// The header with the resources and the side menu stay in view while the
// page scrolls (#193). Desktop: the header gets slimmer while scrolled (the
// logo line goes above the screen, the resources stay, D2) and is full again
// at the top; the menu stays below it. The logo has a line of its own where
// the header wraps (below about 1,210 px, measured 1,100 px: 128 px high,
// 72 px scrolled); wider, the header is one line of 72 px and stays whole. The phone keeps its header as it was
// (sticky, full height; owner, 2026-11-14) and its fixed tab bar. On both,
// a focused element is never under the header or the tab bar (WCAG 2.4.11).

const scrollTo = (page: Page, y: number | 'end'): Promise<void> =>
  page.evaluate((to) => {
    window.scrollTo(
      0,
      to === 'end' ? document.documentElement.scrollHeight : to,
    );
  }, y);

const scrollY = (page: Page): Promise<number> =>
  page.evaluate(() => window.scrollY);

/** Top and bottom of an element on the screen. */
async function edges(
  locator: Locator,
): Promise<{ top: number; bottom: number }> {
  const box = (await locator.boundingBox())!;
  return { top: box.y, bottom: box.y + box.height };
}

/** Where the screen is free: below the header, above the tab bar if any. */
async function freeArea(page: Page): Promise<{ top: number; bottom: number }> {
  const top = (await edges(page.locator('header'))).bottom;
  const tabbar = page.locator('#tabbar');
  const bottom = (await tabbar.isVisible())
    ? (await edges(tabbar)).top
    : page.viewportSize()!.height;
  return { top, bottom };
}

/** The links and controls of the view, in the order of the Tab key. */
const focusables = (page: Page): Locator =>
  page.locator(
    'main :is(a[href], button, input, select):not([disabled], [hidden])',
  );

/** The element in focus lies in the free area of the screen. */
async function expectFocusInFreeArea(page: Page): Promise<void> {
  const focused = page.locator(':focus');
  await expect(focused).toBeInViewport({ ratio: 1 });
  const free = await freeArea(page);
  const box = await edges(focused);
  expect(box.top).toBeGreaterThanOrEqual(free.top);
  expect(box.bottom).toBeLessThanOrEqual(free.bottom);
}

/**
 * The keyboard brings an element out of sight into view: Tab down to the last
 * control of the view and Shift+Tab up to one in the middle, each time from
 * its neighbour focused without scrolling.
 */
async function focusFlow(page: Page): Promise<void> {
  const all = focusables(page);
  const count = await all.count();
  expect(count).toBeGreaterThan(10);

  await scrollTo(page, 0);
  const last = all.nth(count - 1);
  await expect(last).not.toBeInViewport();
  await all.nth(count - 2).evaluate((el) => {
    (el as HTMLElement).focus({ preventScroll: true });
  });
  await page.keyboard.press('Tab');
  await expect(last).toBeFocused();
  await expectFocusInFreeArea(page);

  await scrollTo(page, 'end');
  const mid = Math.floor(count / 2);
  const target = all.nth(mid);
  await expect(target).not.toBeInViewport();
  await all.nth(mid + 1).evaluate((el) => {
    (el as HTMLElement).focus({ preventScroll: true });
  });
  await page.keyboard.press('Shift+Tab');
  await expect(target).toBeFocused();
  await expectFocusInFreeArea(page);
}

async function openLongView(
  page: Page,
  width: number,
  name = uniqueName('Kopfleiste'),
): Promise<void> {
  await register(page, name);
  await nav(page, 'buildings');
  await expect(page.locator('h2')).toContainText('Gebäude');
  await page.setViewportSize({ width, height: 700 });
}

test.describe('the header stays in view (#193)', () => {
  test('desktop: resources and menu stay, the header slims', async ({
    page,
  }) => {
    const w = watch(page);
    await openLongView(page, 1100);
    const header = page.locator('header');
    const logo = page.locator('header .logo');
    const resbar = page.locator('#resbar');
    const menu = page.locator('#menu');

    await scrollTo(page, 0);
    await expect(logo).toBeInViewport({ ratio: 1 });
    const full = await edges(header);
    expect(full.top).toBe(0);

    await scrollTo(page, 'end');
    expect(await scrollY(page)).toBeGreaterThan(1000);
    await expect(resbar).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#menu [data-v=overview]')).toBeInViewport({
      ratio: 1,
    });
    await expect(menu.locator('a').last()).toBeInViewport({ ratio: 1 });
    // Slimmer: the logo line is above the screen, the header ends higher.
    await expect(logo).not.toBeInViewport();
    const slim = await edges(header);
    expect(slim.bottom).toBeLessThan(full.bottom - 20);
    expect((await edges(resbar)).top).toBeGreaterThanOrEqual(0);
    // The menu starts below the header, not under it.
    expect((await edges(menu)).top).toBeGreaterThanOrEqual(slim.bottom - 1);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze()
      ).violations.map((v) => `${v.id}: ${v.help}`),
    ).toEqual([]);

    // Full again at the top.
    await scrollTo(page, 0);
    await expect(logo).toBeInViewport({ ratio: 1 });
    expect(await edges(header)).toEqual(full);

    await focusFlow(page);
    expect(w.problems).toEqual([]);
  });

  test('desktop, wide: one line that stays whole', async ({ page }) => {
    const w = watch(page);
    // A short name, so the header line fits beside logo and resources.
    await openLongView(page, 1280, uniqueName('K'));
    const header = page.locator('header');
    const logo = page.locator('header .logo');
    await scrollTo(page, 0);
    const full = await edges(header);
    // Logo, header line and resources side by side: nothing to hide.
    expect((await edges(page.locator('#resbar'))).top).toBeLessThan(
      (await edges(logo)).bottom,
    );

    await scrollTo(page, 'end');
    expect(await scrollY(page)).toBeGreaterThan(1000);
    await expect(page.locator('#resbar')).toBeInViewport({ ratio: 1 });
    await expect(logo).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#menu a').last()).toBeInViewport({ ratio: 1 });
    expect(await edges(header)).toEqual(full);

    await focusFlow(page);
    expect(w.problems).toEqual([]);
  });

  test('phone: the resources stay, the header as before @phone', async ({
    page,
  }) => {
    const w = watch(page);
    await openLongView(page, page.viewportSize()!.width);
    const header = page.locator('header');
    await scrollTo(page, 0);
    const full = await edges(header);

    await scrollTo(page, 'end');
    expect(await scrollY(page)).toBeGreaterThan(1000);
    await expect(page.locator('#resbar')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('header .logo')).toBeInViewport({ ratio: 1 });
    expect(await edges(header)).toEqual(full);

    await focusFlow(page);
    expect(w.problems).toEqual([]);
  });
});
