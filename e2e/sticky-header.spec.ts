// The header with the resources stays in view while the page scrolls, on the
// desktop together with the side menu, on the phone with the fixed tab bar,
// and the keyboard focus is never hidden under them (#193, WCAG 2.4.11).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  nav,
  openAllRows,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const isPhone = (page: Page): boolean =>
  (page.viewportSize()?.width ?? 1280) <= 760;

/** A long view: the buildings are listed one below the other. */
async function longView(page: Page, name: string, fresh = true): Promise<void> {
  if (fresh) await register(page, name);
  await nav(page, 'buildings');
  await expect(page.locator('h2')).toContainText('Gebäude');
  // On a phone the rows are compact; every one unfolded makes the page long.
  await openAllRows(page);
  const reach = await page.evaluate(
    () => document.documentElement.scrollHeight - window.innerHeight,
  );
  // The page really scrolls, so the checks below mean something.
  expect(reach).toBeGreaterThan(600);
}

/** Where the focused element is against what stays in view. */
async function focusState(page: Page): Promise<string | null> {
  const at = await page.evaluate(() => {
    const el = document.activeElement;
    // What belongs to the fixed parts themselves needs no clearance.
    if (
      !el ||
      el === document.body ||
      el.closest('header, #menu, #tabbar, #more, dialog')
    )
      return null;
    const box = el.getBoundingClientRect();
    const bar = document.querySelector('#tabbar')!.getBoundingClientRect();
    return {
      text: `${el.tagName.toLowerCase()} ${(el.textContent ?? '').trim().slice(0, 30)}`,
      top: box.top,
      bottom: box.bottom,
      size: box.width * box.height,
      head: document.querySelector('header')!.getBoundingClientRect().bottom,
      floor: bar.height > 0 && bar.top > 0 ? bar.top : window.innerHeight,
    };
  });
  if (!at || at.size === 0) return null;
  if (at.top < at.head - 1)
    return `${at.text}: top ${Math.round(at.top)} is under the header (bottom ${Math.round(at.head)})`;
  if (at.bottom > at.floor + 1)
    return `${at.text}: bottom ${Math.round(at.bottom)} is under the tab bar or off the screen (${Math.round(at.floor)})`;
  return null;
}

async function stickyFlow(page: Page): Promise<void> {
  const w = watch(page);
  const phone = isPhone(page);
  await longView(page, uniqueName(phone ? 'KlebHandy' : 'KlebTisch'));
  const inView = async (): Promise<void> => {
    await expect(page.locator('#resbar')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#resbar .res').first()).toBeInViewport({
      ratio: 1,
    });
    await expect(
      phone
        ? page.locator('#tabbar [data-v=overview]')
        : page.locator('#menu [data-v=overview]'),
    ).toBeInViewport({ ratio: 1 });
  };
  await inView();
  for (const y of [400, 1500, 100000]) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(300);
    await expect(page.locator('html')).toHaveClass(/scrolled/);
    await inView();
    const box = await page.locator('#resbar').boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    if (!phone) {
      // The last entry of the menu stays reachable on the desktop too.
      await expect(page.locator('#menu [data-v=help]')).toBeInViewport();
    }
  }
  // axe on the scrolled page, with the header stuck on top of the content.
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

  // Keyboard focus: tab down the page, then back up; no focused element of
  // the content lies under the header or the tab bar (WCAG 2.4.11).
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator('html')).not.toHaveClass(/scrolled/);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  const hidden: string[] = [];
  let deepest = 0;
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press('Tab');
    const state = await focusState(page);
    if (state) hidden.push(`Tab ${i + 1}: ${state}`);
    deepest = Math.max(deepest, await page.evaluate(() => window.scrollY));
  }
  // A real way down, so focus was moved to elements far below the first screen.
  expect(deepest).toBeGreaterThan(300);
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Shift+Tab');
    const state = await focusState(page);
    if (state) hidden.push(`Shift+Tab ${i + 1}: ${state}`);
  }
  expect(hidden).toEqual([]);
  await inView();
  expect(w.problems).toEqual([]);
}

test.describe('the header stays in view (#193)', () => {
  test('the resource bar and the menu stay in view while scrolling, and focus is not hidden', async ({
    page,
  }) => {
    test.slow();
    await stickyFlow(page);
  });

  test('the resource bar and the tab bar stay in view while scrolling, and focus is not hidden, on a phone @phone', async ({
    page,
  }) => {
    test.slow();
    await stickyFlow(page);
  });
});

test.describe('the planet choice stays in view while scrolled (#348)', () => {
  test('a header of two lines: only the logo goes, the planet choice, „Kommandant …“ and „Logout“ stay and work', async ({
    page,
  }) => {
    test.skip(isPhone(page), 'the phone keeps its header (#348)');
    test.slow();
    // At 1,100 px the resources take a line of their own below the logo.
    await page.setViewportSize({ width: 1100, height: 800 });
    const w = watch(page);
    const name = uniqueName('KlebPlanet');
    await register(page, name);
    seed({ name, colony: { name: uniqueName('Kolonie') } });
    await page.reload();
    await longView(page, name, false);
    await expect(page.locator('html')).not.toHaveClass(/head-line/);
    const logo = page.locator('header .logo');
    const select = page.locator('#planet_select');
    const logout = page.locator('#pinfo [data-act=logout]');
    // At the top the header is as before: the logo is there.
    await expect(logo).toBeVisible();
    await expect(logo).toBeInViewport({ ratio: 1 });
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect(page.locator('html')).toHaveClass(/scrolled/);
    await expect(logo).toBeHidden();
    for (const part of [select, logout, page.locator('#resbar')])
      await expect(part).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#pinfo')).toContainText(`Kommandant ${name}`);
    // The planet choice is above the resources and the menu below the header.
    const pinfo = (await page.locator('#pinfo').boundingBox())!;
    const bar = (await page.locator('#resbar').boundingBox())!;
    expect(pinfo.y + pinfo.height).toBeLessThanOrEqual(bar.y + 1);
    const head = (await page.locator('header').boundingBox())!;
    const menu = (await page.locator('#menu').boundingBox())!;
    expect(menu.y).toBeGreaterThanOrEqual(head.y + head.height - 1);
    // The planet changes without scrolling up.
    const before = await page.evaluate(() => window.scrollY);
    const other = await select
      .locator('option:not(:checked)')
      .first()
      .getAttribute('value');
    await select.selectOption(other!);
    await expect(select).toHaveValue(other!);
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    expect(before).toBeGreaterThan(300);
    // The keyboard focus keeps clear of what stays of the header.
    await page.locator('#view').focus();
    const hidden: string[] = [];
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const state = await focusState(page);
      if (state) hidden.push(`Tab ${i + 1}: ${state}`);
    }
    expect(hidden).toEqual([]);
    // Back at the top the logo is there again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('html')).not.toHaveClass(/scrolled/);
    await expect(logo).toBeVisible();
    expect(w.problems).toEqual([]);
  });
});
