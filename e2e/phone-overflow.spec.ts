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

test('a name of 20 wide letters stays left of the points on the highscore (#189) @phone', async ({
  page,
}) => {
  const w = watch(page);
  // The widest name a player may have: 20 characters, each a W.
  const name = 'W'.repeat(20);
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
  const tag = uniqueName('WW').toUpperCase();
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

test('the admin reads the chat of a guild with the longest tag and name on a 360 px phone (#277) @phone', async ({
  page,
}) => {
  const w = watch(page);
  // The longest tag (8) and name (32), without a space, as in #274.
  const tag = uniqueName('WW').toUpperCase();
  const guild = `${'W'.repeat(26)}${tag.slice(2)}`;
  const admin = uniqueName('Spielleitung');
  await page.setViewportSize({ width: 360, height: 800 });
  await register(page, admin);
  cli('admin', admin);
  await page.goto('/?view=guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(guild);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page).toHaveURL(/view=guilds&guild=/);
  await page.reload();
  await page.getByRole('button', { name: 'Chat lesen' }).click();
  // The title „Chat [TAG] Name“ stays inside the dialog, the dialog on the
  // screen.
  const title = page.locator('#dialog-title');
  await expect(title).toHaveText(`Chat [${tag}] ${guild}`);
  const box = await title.evaluate((e) => ({
    scroll: e.scrollWidth,
    client: e.clientWidth,
    right: e.parentElement!.getBoundingClientRect().right,
    screen: document.documentElement.clientWidth,
  }));
  const found = await overflow(page, 'chat dialog');
  if (box.scroll > box.client + 1)
    found.push(`chat dialog title: ${box.scroll} px > ${box.client} px`);
  if (box.right > box.screen + 1)
    found.push(`chat dialog: right edge ${box.right} px > ${box.screen} px`);
  expect(found).toEqual([]);
  expect(w.problems).toEqual([]);
});

test('a rank name of 24 wide letters stays within a 360 px phone (#277) @phone', async ({
  page,
  browser,
}) => {
  const w = watch(page);
  // The longest rank name (24 characters), of wide letters, without a space:
  // 912 px wide before #277.
  const rank = 'W'.repeat(24);
  const tag = `R${Date.now() % 1000000}`;
  const lead = uniqueName('Leitung');
  const member = uniqueName('Mitglied');
  await page.setViewportSize({ width: 360, height: 800 });
  await register(page, lead);
  await page.goto('/?view=guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(`Rang ${tag}`);
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
  await other.close();
  await page.goto(url);
  await page
    .locator('p', { hasText: member })
    .getByRole('button', { name: 'Annehmen' })
    .click();
  await expect(page.getByRole('cell', { name: member })).toBeVisible();
  // The rank shows in the column „Rang“, in „Rang ändern“ and in „Ränge“.
  await page.getByLabel('Name des neuen Rangs').fill(rank);
  await page.getByRole('button', { name: 'Rang anlegen' }).click();
  await expect(page.getByRole('group', { name: rank })).toBeVisible();
  const row = page.locator('tr', { hasText: member });
  await row
    .getByLabel(`Neuer Rang für ${member}`)
    .selectOption({ label: rank });
  await row.getByRole('button', { name: 'Rang ändern' }).click();
  await expect(row.locator('td.rank')).toHaveText(rank);

  await page.reload();
  await expect(row.locator('td.rank')).toHaveText(rank);
  await expect(page.getByRole('group', { name: rank })).toBeVisible();
  await page.waitForLoadState('networkidle');
  expect(await overflow(page, 'guild of the Leitung')).toEqual([]);
  expect(w.problems).toEqual([]);
  expect(wo.problems).toEqual([]);
});
