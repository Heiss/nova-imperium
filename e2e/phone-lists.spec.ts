// The phone view of the lists and the fleet form (#189): the four lists of
// buildings, research, shipyard and defense have the compact rows with the
// filter „Baubar“ and the fold „Details zu …“; they must be usable for a
// screen reader (axe, WCAG 2.1 A and AA) with every row unfolded and the
// locked entries shown. And the fleet form, open with a Schnellwahl entry of
// the longest name, must not make the page wider than a 360 px phone: a select
// is as wide as its longest option unless the form holds it. The pages of the
// whole game at 360 px are in e2e/phone-overflow.spec.ts, the axe checks of
// the desktop in e2e/a11y.spec.ts.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import {
  nav,
  openAllRows,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

test('the lists of buildings, research, shipyard and defense have no axe violations on a phone @phone', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('PhoneListen');
  await register(page, name);
  // Entries in every state: built, upgrading, affordable, locked, not enough
  // resources; a Scholarium for the research, a Schiffsschmiede for the
  // shipyard and the defense.
  seed({
    name,
    b: { metal: 6, crystal: 4, lab: 2, yard: 3, robot: 2 },
    research: { energy: 2, comb: 1 },
    res: { m: 5000, c: 2000, d: 500 },
  });
  await page.reload();
  const found: string[] = [];
  for (const view of ['buildings', 'research', 'shipyard', 'defense']) {
    await nav(page, view);
    await openAllRows(page);
    const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
    found.push(...results.violations.map((v) => `${view}: ${v.id}: ${v.help}`));
  }
  expect(found).toEqual([]);
  expect(w.problems).toEqual([]);
});

test('the open fleet form with a long Schnellwahl entry stays within a 360 px phone @phone', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('PhoneFlotte');
  await register(page, name);
  // A colony with a moon, named with the widest letters a name may have: its
  // Schnellwahl entry is the longest the list can hold of the own places.
  const long = 'W'.repeat(20);
  seed({
    name,
    ships: { sc: 2, lf: 3 },
    res: { m: 0, c: 0, d: 10000 },
    colony: { name: long },
    colonyMoon: { name: long },
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?view=fleet');
  const quick = page.getByLabel('Schnellwahl');
  const entry = quick.locator('option', { hasText: `${long} (Mond)` });
  await expect(entry).toHaveCount(1);
  await quick.selectOption({ label: (await entry.textContent())! });
  // The choice is entered as the target, and the form shows the moon.
  await expect(page.getByLabel('Zielart')).toHaveValue('moon');
  await page.getByLabel('Anzahl Frachtläufer').fill('1');
  await expect(page.locator('#t_info')).toContainText(long);

  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
    // The widest thing of the form, to name it when the page is too wide.
    wide: [...document.querySelectorAll('#view *')]
      .map((el) => ({
        el: `${el.tagName.toLowerCase()}#${el.id}.${el.className} ${el.textContent!.slice(0, 40)}`,
        right: Math.round(el.getBoundingClientRect().right),
      }))
      .sort((a, b) => b.right - a.right)[0],
  }));
  expect(widths.client).toBe(360);
  expect(widths.scroll, JSON.stringify(widths.wide)).toBeLessThanOrEqual(
    widths.client + 1,
  );
  // The select itself fits its cell.
  const box = await quick.boundingBox();
  expect(box!.x + box!.width).toBeLessThanOrEqual(widths.client);
  expect(w.problems).toEqual([]);
});
