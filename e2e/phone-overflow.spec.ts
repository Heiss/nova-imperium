import { expect, test, type Page } from '@playwright/test';
import {
  cli,
  guildTag,
  onlyOwnPlayers,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';
import { ADMIN_TABS } from '../src/client/views/misc.ts';

// No view is wider than a small phone (#189, D7): at 360 px the page must not
// scroll sideways. The resources page was 588 px wide on a 390 px phone, the
// highscore 415 px with names of 20 characters.

/** Every view of the navigation, in its order; the admin's tabs below. */
const VIEWS = [
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
  'admin',
];

/**
 * How far the page reaches past the screen, with a pixel for rounding. A
 * failure names the elements that reach furthest, so the CI log shows what
 * made the page wide.
 */
async function overflow(page: Page, label: string): Promise<string[]> {
  const { scroll, client, wide } = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('body *')]
      .map((el) => ({ el, right: el.getBoundingClientRect().right }))
      .filter((x) => x.right > client + 1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 3)
      .map(
        (x) =>
          `${x.el.tagName.toLowerCase()}.${x.el.className} to ${Math.round(x.right)} px`,
      );
    return {
      scroll: document.documentElement.scrollWidth,
      client,
      wide,
    };
  });
  return scroll > client + 1
    ? [`${label}: ${scroll} px > ${client} px (${wide.join(', ')})`]
    : [];
}

test('no view is wider than a 360 px phone (#189) @phone', async ({ page }) => {
  const w = watch(page);
  // The longest name a player may have (20 characters), as on the highscore.
  const name = uniqueName('Schmalbildschi');
  // The highscore shows this test's player only, whatever other tests seeded.
  await onlyOwnPlayers(page);
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

test('a name of 20 wide letters stays left of the points on the highscore (#189) @phone', async ({
  page,
}) => {
  const w = watch(page);
  // The widest name a player may have: 20 characters of the widest capitals
  // (W and M), the last six drawn so that the name is this test's own.
  const name = uniqueName('W'.repeat(14), 'WM');
  await onlyOwnPlayers(page);
  await register(page, name);
  seed({ name, b: { metal: 30, crystal: 28, solar: 30 } });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?view=highscore');
  const row = page.locator('.scores tr.me');
  await expect(row.locator('td').nth(1)).toHaveText(name);
  await expect(row.locator('td').nth(3)).not.toHaveText('0');
  const box = await row.evaluate((tr) => {
    const cells = tr.querySelectorAll('td');
    // The name's text itself, not its cell: a name too long for its cell
    // spills over the points.
    const text = document.createRange();
    text.selectNodeContents(cells[1]!);
    return {
      nameRight: text.getBoundingClientRect().right,
      pointsLeft: cells[3]!.getBoundingClientRect().left,
      rowScroll: tr.scrollWidth,
      rowWidth: tr.clientWidth,
    };
  });
  expect(box.nameRight).toBeLessThanOrEqual(box.pointsLeft);
  expect(box.rowScroll).toBeLessThanOrEqual(box.rowWidth);
  expect(await overflow(page, 'highscore')).toEqual([]);
  expect(w.problems).toEqual([]);
});

test('a guild with the longest tag and name stays within a 360 px phone (#274) @phone', async ({
  page,
  browser,
}) => {
  const w = watch(page);
  // The longest tag (8) and name (32) a guild may have, without a space, of
  // wide letters; unique, as the server refuses a second guild with either.
  const tag = guildTag('WW');
  const guild = `${'W'.repeat(26)}${tag.slice(2)}`;
  const heading = `[${tag}] ${guild}`;
  // The longest name a player may have (20 characters), of wide letters.
  const lead = uniqueName('W'.repeat(14));
  const member = uniqueName('M'.repeat(14));
  await page.setViewportSize({ width: 360, height: 800 });
  await register(page, lead);
  await page.goto('/?view=guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(guild);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page).toHaveURL(/view=guilds&guild=/);
  const url = page.url();
  // The guild page and the list first: a too wide page also hides buttons
  // behind its boxes on a phone.
  await page.reload();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const alone = await overflow(page, 'guild of the Leitung alone');
  await page.goto('/?view=guilds');
  await expect(page.getByRole('link', { name: heading })).toBeVisible();
  await page.waitForLoadState('networkidle');
  alone.push(...(await overflow(page, 'guild list')));
  expect(alone).toEqual([]);
  // A member with a long name: the Leitung sees its rank and the controls.
  const other = await browser.newPage({
    viewport: { width: 360, height: 800 },
  });
  const wo = watch(other);
  await register(other, member);
  await other.goto(url);
  await other.getByRole('button', { name: 'Bewerben' }).click();
  await expect(other.getByText('Deine Bewerbung ist offen.')).toBeVisible();
  await page.goto(url);
  await page
    .locator('p', { hasText: member })
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(page.getByRole('cell', { name: member })).toBeVisible();

  const found: string[] = [];
  await page.reload();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.waitForLoadState('networkidle');
  found.push(...(await overflow(page, 'guild of the Leitung')));
  await other.reload();
  await expect(other.getByRole('heading', { name: heading })).toBeVisible();
  await other.waitForLoadState('networkidle');
  found.push(...(await overflow(other, 'guild of the member')));
  expect(found).toEqual([]);
  await other.close();
  expect(w.problems).toEqual([]);
  expect(wo.problems).toEqual([]);
});

test('the highscore stays within a 360 px phone with the largest numbers, in every category (#78, #189) @phone', async ({
  page,
}) => {
  const w = watch(page);
  // Wider than any real font could make a normal number: levels and counts
  // of 40 digits and more as points, and the widest name. The name gives way,
  // the page never gets wider (CI of #316: a seeded level of 100 made 31
  // digits and the table pushed the page to 373 px).
  const name = uniqueName('W'.repeat(14));
  await onlyOwnPlayers(page);
  await register(page, name);
  seed({
    name,
    b: { robot: 150 },
    research: { carto: 150 },
    ships: { probe: 1e15 },
    def: { gauss: 1e15 },
  });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/?view=highscore');
  await expect(page.locator('.scores tr.me td').nth(1)).toHaveText(name);
  const found: string[] = [];
  for (const category of [
    'Gesamt',
    'Gebäude',
    'Forschung',
    'Flotte',
    'Verteidigung',
  ]) {
    await page.getByRole('button', { name: category }).click();
    await expect(page.getByRole('button', { name: category })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.locator('.scores tr.me td').nth(3)).not.toHaveText('0');
    found.push(...(await overflow(page, `highscore ${category}`)));
  }
  expect(found).toEqual([]);
  expect(w.problems).toEqual([]);
});

test('a rank name of 24 wide letters fits a 360 px phone: select, legend and chat title (#277) @phone', async ({
  page,
  browser,
}) => {
  // Three players register, each a second or so (#302).
  test.slow();
  const w = watch(page);
  const tag = guildTag('WW');
  const guild = `${'W'.repeat(26)}${tag.slice(2)}`;
  const heading = `[${tag}] ${guild}`;
  // The longest name a rank may have (owner, 2026-11-17), of the widest letter.
  const rankName = 'W'.repeat(24);
  const lead = uniqueName('W'.repeat(14));
  const member = uniqueName('M'.repeat(14));
  const adminName = uniqueName('Aufsichtbreit');
  await page.setViewportSize({ width: 360, height: 800 });
  await register(page, lead);
  await page.goto('/?view=guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(guild);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page).toHaveURL(/view=guilds&guild=/);
  const url = page.url();
  const other = await browser.newPage({
    viewport: { width: 360, height: 800 },
  });
  const wo = watch(other);
  await register(other, member);
  await other.goto(url);
  await other.getByRole('button', { name: 'Bewerben' }).click();
  await expect(other.getByText('Deine Bewerbung ist offen.')).toBeVisible();
  await page.goto(url);
  await page
    .locator('p', { hasText: member })
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(page.getByRole('cell', { name: member })).toBeVisible();

  // Create the rank with 24 characters and give it to the member.
  await page.getByLabel('Name des neuen Rangs').fill(rankName);
  await page.getByRole('button', { name: 'Rang anlegen' }).click();
  await expect(page.locator('.toast').last()).toContainText('Rang angelegt.');
  const row = page.locator('tr').filter({
    has: page.getByRole('cell', { name: member, exact: true }),
  });
  await row
    .getByLabel(`Neuer Rang für ${member}`)
    .selectOption({ label: rankName });
  await row.getByRole('button', { name: 'Rang ändern' }).click();
  await expect(page.locator('.toast').last()).toContainText('Rang vergeben.');
  await expect(row.locator('td.rank')).toHaveText(rankName);

  const found: string[] = [];
  const within = async (label: string, selector: string): Promise<void> => {
    const bad = await page.evaluate((sel) => {
      const client = document.documentElement.clientWidth;
      return [...document.querySelectorAll(sel)]
        .map((el) => el.getBoundingClientRect())
        .filter((r) => r.left < -1 || r.right > client + 1)
        .map((r) => `${Math.round(r.left)}..${Math.round(r.right)}`);
    }, selector);
    if (bad.length > 0) found.push(`${label}: ${bad.join(', ')}`);
  };
  await expect(page.locator('fieldset.rank legend').first()).toBeVisible();
  found.push(...(await overflow(page, 'guild with the 24-character rank')));
  await within('rank select', '.rank-select');
  await within('rank cell', 'td.rank');
  await within('rank legend', 'fieldset.rank legend');
  expect(found).toEqual([]);
  // The legend of the new rank shows the whole name, wrapped.
  await expect(
    page.locator('fieldset.rank legend', { hasText: rankName }),
  ).toBeVisible();

  // A rename to 24 characters passes, one of 25 is refused (the field's
  // maxlength does not stop a script; the server checks).
  const fieldset = page
    .locator('fieldset.rank')
    .filter({ has: page.locator('legend', { hasText: rankName }) });
  const id = await fieldset
    .getByRole('button', { name: 'Umbenennen' })
    .getAttribute('data-rank');
  const input = page.locator(`#rank_name_${id}`);
  const rename = page.locator(`[data-act=rankRename][data-rank="${id}"]`);
  await input.fill('M'.repeat(24));
  await rename.click();
  await expect(page.locator('.toast').last()).toContainText('Rang umbenannt.');
  await expect(row.locator('td.rank')).toHaveText('M'.repeat(24));
  // fill() obeys the maxlength of the field, so a script sets the value.
  await expect(input).toHaveAttribute('maxlength', '24');
  await input.evaluate((el: HTMLInputElement) => {
    el.value = 'M'.repeat(25);
  });
  await rename.click();
  await expect(page.locator('.toast').last()).toContainText(
    'Der Rangname braucht 2 bis 24 Zeichen.',
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await overflow(page, 'guild after the rename')).toEqual([]);

  // The admin's chat dialog: the title with tag and the long name wraps.
  const admin = await browser.newPage({
    viewport: { width: 360, height: 800 },
  });
  const wa = watch(admin);
  await register(admin, adminName);
  cli('admin', adminName);
  await admin.goto(url);
  await admin.getByRole('button', { name: 'Chat lesen' }).click();
  const dialog = admin.locator('#modal');
  const title = dialog.getByRole('heading', { name: `Chat ${heading}` });
  await expect(title).toBeVisible();
  const box = await dialog.evaluate((d) => {
    const h = d.querySelector('#dialog-title')!;
    return {
      titleScroll: h.scrollWidth,
      titleWidth: h.clientWidth,
      dialogRight: d.getBoundingClientRect().right,
      titleRight: h.getBoundingClientRect().right,
      client: document.documentElement.clientWidth,
    };
  });
  expect(box.titleScroll).toBeLessThanOrEqual(box.titleWidth + 1);
  expect(box.titleRight).toBeLessThanOrEqual(box.dialogRight + 1);
  expect(box.dialogRight).toBeLessThanOrEqual(box.client + 1);
  expect(await overflow(admin, 'admin chat dialog')).toEqual([]);

  await other.close();
  await admin.close();
  expect(w.problems).toEqual([]);
  expect(wo.problems).toEqual([]);
  expect(wa.problems).toEqual([]);
});
