// Touch targets of at least 44 px on a phone (#189, owner 2026-11-14; the
// check of the former `small` buttons is „Still to do“ in
// okf/features/interface.md). The first test measures the controls the phone
// view of #189 made for the finger and passes. The second measures every
// interactive element of the phone views against the decided 44 px and is
// marked `test.fail()`: it states the rule, and it fails today for the
// elements named in its message (the plain buttons of 30 px, the `small`
// buttons of 23 px, the „?“ and „▤“ of 24 px, the fields of 31 px and the
// links of the Lexicanum), which the owner has to decide to restyle. The day
// they are fixed it starts to pass, and Playwright then reports it, so the
// marker is removed and the rule is kept for good.
import { expect, test, type Page } from '@playwright/test';
import { nav, openAllRows, register, seed, uniqueName } from './helpers.ts';

const MIN = 44;

/** What the page holds of interactive elements below `MIN` px, by kind. */
async function small(page: Page, within = 'body'): Promise<string[]> {
  return page.evaluate(
    ([root, min]) => {
      const selector =
        'button, a[href], select, textarea, summary, [role=button], [role=tab], input:not([type=hidden]):not([type=checkbox]):not([type=radio])';
      const found = new Map<string, number>();
      for (const el of document
        .querySelector(root!)!
        .querySelectorAll(selector)) {
        const box = el.getBoundingClientRect();
        const hidden =
          box.width === 0 ||
          box.height === 0 ||
          getComputedStyle(el).visibility === 'hidden';
        if (hidden || (box.width >= +min! && box.height >= +min!)) continue;
        const act = (el as HTMLElement).dataset.act;
        const key = `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).replace(/\s+/g, '.')}` : ''}${act ? `[${act}]` : ''} ${Math.round(box.width)}x${Math.round(box.height)}`;
        found.set(key, (found.get(key) ?? 0) + 1);
      }
      return [...found].map(([k, n]) => `${k} (${n}x)`);
    },
    [within, String(MIN)] as const,
  );
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

test('every interactive element of the phone views is at least 44 px (#189, decided 2026-11-14) @phone', async ({
  page,
}) => {
  // Known to fail until the owner has the plain buttons, the `small` buttons,
  // the icons and the fields restyled for the phone; see the head of the file.
  test.fail();
  test.slow();
  const name = uniqueName('Fingerbreit');
  await register(page, name);
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
  expect(found).toEqual([]);
});
