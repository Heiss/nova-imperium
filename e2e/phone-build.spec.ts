// The tab „Bauen“ on a phone (#189, D2 to D4): the switch Gebäude / Forschung
// / Schiffsschmiede / Abwehr, the filter „Baubar“ (the default) / „Alle“ /
// „Läuft“, the compact rows that unfold on a tap, and the short button
// „▲ 5“. The axe check of the lists is in e2e/phone-lists.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import { nav, register, seed, uniqueName, watch } from './helpers.ts';

const filter = (page: Page, label: string) =>
  page
    .getByRole('group', { name: 'Filter' })
    .getByRole('button', { name: label, exact: true });

test('the build flow in the tab „Bauen“: filter, unfold and „▲ 5“ @phone', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Bauer');
  await register(page, name);
  // The Adamantmine on level 4 (the next level is 5) and plenty to pay it; no
  // Robotfabrik, so the Nanitenfabrik is locked.
  seed({ name, b: { metal: 4 }, res: { m: 50000, c: 50000, d: 50000 } });
  await page.reload();
  await nav(page, 'buildings');
  await expect(page.locator('h2')).toHaveText('Gebäude');

  const rows = page.locator('.catalog > .item');
  const locked = rows.locator('xpath=self::*[@data-phase="locked"]');
  const open = rows.locator('xpath=self::*[@data-phase="open"]');
  const metal = page.locator('.catalog > .item', {
    has: page.locator('#exq_metal'),
  });

  // „Baubar“ is the default: locked entries are hidden.
  await expect(filter(page, 'Baubar')).toHaveAttribute('aria-pressed', 'true');
  await expect(open.first()).toBeVisible();
  expect(await locked.count()).toBeGreaterThan(0);
  await expect(locked.first()).toBeHidden();

  // „Alle“ shows them with what they need, without a tap.
  await filter(page, 'Alle').click();
  await expect(filter(page, 'Alle')).toHaveAttribute('aria-pressed', 'true');
  await expect(locked.first()).toBeVisible();
  await expect(locked.first().locator('.needs')).toBeVisible();
  await filter(page, 'Baubar').click();
  await expect(locked.first()).toBeHidden();

  // „Läuft“ with nothing running says so, and shows no row.
  await filter(page, 'Läuft').click();
  await expect(page.getByText('Es läuft gerade nichts.')).toBeVisible();
  await expect(open.first()).toBeHidden();
  await filter(page, 'Baubar').click();

  // A row unfolds on a tap: the description and the „?“ come into sight.
  const fold = metal.getByRole('button', { name: /^Details zu / });
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await expect(metal.locator('.ds')).toBeHidden();
  await expect(metal.locator('button.exq')).toBeHidden();
  await fold.click();
  await expect(fold).toHaveAttribute('aria-expanded', 'true');
  await expect(metal.locator('.ds')).toBeVisible();
  await expect(metal.locator('button.exq')).toBeVisible();
  await fold.click();
  await expect(metal.locator('.ds')).toBeHidden();

  // The short button: „▲ 5“ for the eye, the full name for a screen reader.
  const build = metal.locator('[data-act=build]');
  await expect(build.locator('.sh')).toHaveText('▲ 5');
  await expect(build.locator('.sh')).toBeVisible();
  await expect(build).toHaveAccessibleName('Ausbauen auf Stufe 5');
  await build.click();
  await expect(metal.locator('.act')).toContainText('Ausbau auf Stufe 5');
  await expect(metal).toHaveAttribute('data-phase', 'running');

  // „Läuft“ shows exactly that row, and the choice stays after a reload.
  await filter(page, 'Läuft').click();
  await expect(metal).toBeVisible();
  await expect(
    rows.locator('xpath=self::*[@data-phase!="running"]'),
  ).toHaveCount((await rows.count()) - 1);
  await expect(open.first()).toBeHidden();
  await page.reload();
  await expect(filter(page, 'Läuft')).toHaveAttribute('aria-pressed', 'true');
  await expect(metal).toBeVisible();
  await filter(page, 'Baubar').click();

  // The switch leads to the other three lists.
  const seg = page.getByRole('navigation', { name: 'Bauen' });
  for (const [label, title] of [
    ['Forschung', 'Forschung'],
    ['Schiffsschmiede', 'Schiffsschmiede'],
    ['Abwehr', 'Verteidigung'],
    ['Gebäude', 'Gebäude'],
  ] as const) {
    await seg.getByRole('link', { name: label, exact: true }).click();
    await expect(page.locator('h2')).toHaveText(title);
    await expect(
      seg.getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('aria-current', 'page');
  }
  expect(w.problems).toEqual([]);
});
