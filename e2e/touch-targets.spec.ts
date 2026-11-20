// Touch targets of at least 44 px on a phone (#189, owner 2026-11-14 and
// 2026-11-20). The first test measures the controls the phone view of #189
// made for the finger; the second measures every interactive element (button,
// link, field, list; a check box and a radio button count through their label)
// of the phone views against the 44 px. The rule is in the last block of
// style.css.
import { expect, test, type Page } from '@playwright/test';
import { ADMIN_TABS } from '../src/client/views/misc.ts';
import {
  cli,
  guildTag,
  nav,
  openAllRows,
  register,
  seed,
  uniqueName,
} from './helpers.ts';

const MIN = 44;

/** What the page holds of interactive elements below `MIN` px, by kind. */
async function small(page: Page): Promise<string[]> {
  return page.evaluate((min) => {
    const selector =
      'button, a[href], select, textarea, summary, [role=button], [role=tab], input:not([type=hidden]):not([type=checkbox]):not([type=radio])';
    // Not drawn, or a link inside a sentence (WCAG 2.5.8, inline).
    const skipped = (el: Element, box: DOMRect): boolean =>
      box.width === 0 ||
      box.height === 0 ||
      getComputedStyle(el).visibility === 'hidden' ||
      (el.tagName === 'A' && el.closest('p') !== null);
    const name = (el: Element): string =>
      `${el.tagName.toLowerCase()}${String(el.className).replace(/\s*(\S+)/g, '.$1')}[${(el as HTMLElement).dataset.act ?? ''}]`;
    const found = new Map<string, number>();
    for (const el of document.querySelectorAll(selector)) {
      const box = el.getBoundingClientRect();
      if (skipped(el, box) || (box.width >= min && box.height >= min)) continue;
      const key = `${name(el)} ${Math.round(box.width)}x${Math.round(box.height)}`;
      found.set(key, (found.get(key) ?? 0) + 1);
    }
    return [...found].map(([k, n]) => `${k} (${n}x)`);
  }, MIN);
}

test('the controls the phone view made for the finger are at least 44 px (#189) @phone', async ({
  page,
}) => {
  const name = uniqueName('Finger');
  await register(page, name);
  seed({
    name,
    b: { metal: 4, lab: 2, yard: 3 },
    research: { energy: 2 },
    colony: { name: 'Aussenposten' },
    res: { m: 5000, c: 2000, d: 500 },
  });
  await page.reload();
  const found: string[] = [];
  const check = async (label: string, selector: string): Promise<void> => {
    const boxes = await page.locator(selector).evaluateAll((els) =>
      els
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`),
    );
    expect(boxes.length, `${label} is on the page`).toBeGreaterThan(0);
    for (const box of boxes) {
      const [w, h] = box.split('x').map(Number);
      if (w! < MIN || h! < MIN) found.push(`${label}: ${box}`);
    }
  };
  // The overview with its cards, the header and the tab bar.
  await expect(page.locator('#tabbar')).toBeVisible();
  await expect(page.locator('section.cards')).toBeVisible();
  await check('tab bar', '#tabbar a, #tabbar button');
  await check('planet list', '#planet_select');
  await check('card links and buttons', '.cards li a, .cards li button');
  // „Mehr“ with its entries.
  await page.click('#tabbar [data-act=moreOpen]');
  await check('Mehr entries', '#more-list a');
  await check('Mehr user', '#more-user button');
  await page.reload();
  // The build lists: the switch, the filter, the folds and the row buttons.
  await nav(page, 'buildings');
  await check('switch Bauen', 'nav.seg a');
  await check('filter', 'div.seg button');
  await check('fold', 'button.fold');
  await check('row buttons', '.item .act button');
  // The Sternenkarte: the „⋯“ of a row and the buttons of its sheet.
  await nav(page, 'galaxy');
  await check('„⋯“', 'button.more');
  await page.locator('button.more').first().click();
  await check('action sheet', 'dialog.gal-sheet button');
  expect(found).toEqual([]);
});

test('every interactive element of the phone views is at least 44 px (#189) @phone', async ({
  page,
}) => {
  test.slow();
  const name = uniqueName('Fingerbreit');
  await register(page, name);
  cli('admin', name);
  seed({
    name,
    b: { metal: 6, crystal: 4, lab: 2, yard: 3, robot: 2 },
    research: { energy: 2, comb: 1 },
    ships: { sc: 2 },
    res: { m: 5000, c: 2000, d: 500 },
  });
  await page.setViewportSize({ width: 360, height: 800 });
  const found: string[] = [];
  const views = [
    'overview',
    'buildings',
    'resources',
    'market',
    'research',
    'shipyard',
    'defense',
    'fleet',
    'galaxy',
    'messages',
    'highscore',
    'guilds',
    'friends',
    'achievements',
    'news',
    'lexicanum',
    'help',
  ];
  for (const view of views) {
    await page.goto(`/?view=${view}`);
    await expect(page.locator('h2')).toBeVisible();
    if (['buildings', 'research', 'shipyard', 'defense'].includes(view))
      await openAllRows(page);
    found.push(...(await small(page)).map((s) => `${view}: ${s}`));
  }
  // A guild with its ranks, an article, the admin's tabs, „Mehr“.
  const tag = guildTag('TT');
  await page.goto('/?view=guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(`Finger ${tag}`);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page).toHaveURL(/view=guilds&guild=/);
  await expect(page.locator('fieldset.rank').first()).toBeVisible();
  found.push(...(await small(page)).map((s) => `guild: ${s}`));
  await page.goto('/?view=lexicanum&a=spy');
  await expect(page.locator('#view .lx-title')).toBeVisible();
  found.push(...(await small(page)).map((s) => `article: ${s}`));
  await page.goto('/?view=admin');
  for (const [tab, label] of Object.entries(ADMIN_TABS)) {
    await page.click(`[data-act=adminTab][data-tab=${tab}]`);
    await expect(page.getByRole('tab', { name: label })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // The tables of the tab load after the click.
    await page.waitForTimeout(500);
    found.push(...(await small(page)).map((s) => `admin ${tab}: ${s}`));
  }
  await page.goto('/?view=overview');
  await page.click('#tabbar [data-act=moreOpen]');
  await expect(page.locator('#more')).toBeVisible();
  found.push(...(await small(page)).map((s) => `Mehr: ${s}`));
  expect(found).toEqual([]);
});
