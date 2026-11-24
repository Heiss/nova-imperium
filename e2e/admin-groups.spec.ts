// The settings of the admin panel under the heading of their feature, in
// groups that fold (#357, owner, 2026-11-22): in the tab „Universum“ and in
// the dialog „Neue Runde“, the same headings in the same order, every group
// open at the start; a folded group still sends its values; a value that
// fails its check unfolds its group and takes the focus. No round is started
// here: the request „reset“ of a valid dialog is caught and answered with a
// refusal, and an invalid one is refused by the server.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { cli, lastToast, nav, register, uniqueName, watch } from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** The headings of „Neue Runde“, in the order of the settings (the registry). */
const ROUND_HEADINGS = [
  'Tagesbelohnung und Erfolge',
  'Gilden',
  'Hauptplanet',
  'Kolonie aufgeben',
  'Aktivität',
  'Wache stellen',
  'Fremde Flotten erkennen',
  'Urlaubsmodus',
  'Zurückbauen',
  'Verbandsangriff',
  'Expeditionen',
  'Marktplatz',
  'Planetengrenze',
];

/** The tab „Universum“: the base values, then the features with live settings, in the same order. */
const UNIVERSE_HEADINGS = [
  'Universum',
  // A live setting since #366: the lock of a switch of the main planet.
  'Hauptplanet',
  'Kolonie aufgeben',
  'Aktivität',
  'Wache stellen',
  'Fremde Flotten erkennen',
  'Urlaubsmodus',
  'Zurückbauen',
  'Verbandsangriff',
  'Expeditionen',
  'Marktplatz',
  'Planetengrenze',
];

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const groupsIn = (root: Locator): Locator =>
  root.locator('details.settings-group');
const group = (root: Locator, heading: string): Locator =>
  groupsIn(root).filter({
    has: root.page().getByRole('heading', { name: heading, exact: true }),
  });

/** An admin on the tab „Universum“. */
async function openUniverse(page: Page): Promise<Locator> {
  const name = uniqueName('Gruppen');
  await register(page, name);
  expect(cli('admin', name)).toContain(`${name} is now admin.`);
  await page.reload();
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  return page.locator('#admin-panel-universe');
}

/** Folds or unfolds a group by its heading with the keyboard. */
async function toggle(root: Locator, heading: string): Promise<void> {
  await group(root, heading).locator('summary').focus();
  await root.page().keyboard.press('Enter');
}

for (const tag of ['', ' @phone']) {
  test.describe(`the settings of the admin panel in groups (#357)${tag}`, () => {
    test('„Universum“: headings in order, open at the start, folded and unfolded by keyboard, and a folded group still saves', async ({
      page,
    }) => {
      const w = watch(page);
      const panel = await openUniverse(page);
      await expect(groupsIn(panel).locator('summary h4')).toHaveText(
        UNIVERSE_HEADINGS,
      );
      for (const heading of UNIVERSE_HEADINGS)
        await expect(group(panel, heading)).toHaveAttribute('open', '');
      expect(await violations(page)).toEqual([]);

      const lock = panel.locator('#set_roundAbandonLock');
      const before = await lock.inputValue();
      const next = String(Number(before) + 1);
      await lock.fill(next);
      await toggle(panel, 'Kolonie aufgeben');
      await expect(group(panel, 'Kolonie aufgeben')).not.toHaveAttribute(
        'open',
      );
      await expect(lock).toBeHidden();
      expect(await violations(page)).toEqual([]);
      await panel
        .getByRole('button', { name: 'Einstellungen speichern' })
        .click();
      await expect(lastToast(page)).toContainText('gespeichert');
      // The folded group stays folded over the redraw and the value is saved.
      await expect(group(panel, 'Kolonie aufgeben')).not.toHaveAttribute(
        'open',
      );
      await toggle(panel, 'Kolonie aufgeben');
      await expect(group(panel, 'Kolonie aufgeben')).toHaveAttribute(
        'open',
        '',
      );
      await page.reload();
      await nav(page, 'admin');
      await page.getByRole('tab', { name: 'Universum' }).click();
      await expect(lock).toHaveValue(next);
      // Back to the value of the universe the other tests share: the answer
      // of the save, then the server's value after a reload (review of #347).
      await lock.fill(before);
      const restored = page.waitForResponse(
        (r) =>
          r.url().endsWith('/api/action') &&
          (r.request().postDataJSON() as { type?: string } | null)?.type ===
            'settings',
      );
      await panel
        .getByRole('button', { name: 'Einstellungen speichern' })
        .click();
      expect((await restored).ok()).toBe(true);
      await expect(lastToast(page)).toContainText('gespeichert');
      await page.reload();
      await nav(page, 'admin');
      await page.getByRole('tab', { name: 'Universum' }).click();
      await expect(lock).toHaveValue(before);
      expect(w.problems).toEqual([]);
    });

    test('„Universum“: a refused value in a folded group unfolds it and takes the focus', async ({
      page,
    }) => {
      const w = watch(page);
      const panel = await openUniverse(page);
      const hours = panel.locator('#set_roundVacationHours');
      const before = await hours.inputValue();
      await hours.fill('0');
      await toggle(panel, 'Urlaubsmodus');
      await expect(hours).toBeHidden();
      await panel
        .getByRole('button', { name: 'Einstellungen speichern' })
        .click();
      await expect(group(panel, 'Urlaubsmodus')).toHaveAttribute('open', '');
      await expect(hours).toBeFocused();
      await expect(hours).toHaveAttribute('aria-invalid', 'true');
      await expect(lastToast(page)).toContainText('Urlaubsmodus');
      // Nothing was saved.
      await page.reload();
      await nav(page, 'admin');
      await page.getByRole('tab', { name: 'Universum' }).click();
      await expect(hours).toHaveValue(before);
      expect(w.problems).toEqual([]);
    });

    test('„Neue Runde“: the same headings in the same order, a folded group still sends its values', async ({
      page,
    }) => {
      const w = watch(page);
      const panel = await openUniverse(page);
      let sent: Record<string, unknown> | null = null;
      await page.route('**/api/action', async (route) => {
        const body = route.request().postDataJSON() as {
          type?: string;
          data?: Record<string, unknown>;
        };
        if (body.type !== 'reset') return route.continue();
        sent = body as Record<string, unknown>;
        await route.fulfill({ status: 400, json: { error: 'Abgefangen.' } });
      });
      await panel.getByRole('button', { name: 'Neue Runde starten' }).click();
      const dialog = page.locator('#modal');
      await expect(groupsIn(dialog).locator('summary h4')).toHaveText(
        ROUND_HEADINGS,
      );
      for (const heading of ROUND_HEADINGS)
        await expect(group(dialog, heading)).toHaveAttribute('open', '');
      expect(await violations(page)).toEqual([]);
      // The headings of „Universum“ stand in the same order here.
      const shared = UNIVERSE_HEADINGS.slice(1);
      expect(ROUND_HEADINGS.filter((h) => shared.includes(h))).toEqual(shared);

      await dialog.locator('#round-market-fee').fill('7');
      await toggle(dialog, 'Marktplatz');
      await expect(dialog.locator('#round-market-fee')).toBeHidden();
      expect(await violations(page)).toEqual([]);
      await dialog.getByRole('button', { name: 'Ja, neue Runde' }).click();
      await expect(lastToast(page)).toContainText('Abgefangen.');
      expect(JSON.stringify(sent)).toContain('"marketFee":7');
      expect(w.problems).toEqual([]);
    });

    test('„Neue Runde“: a refused value in a folded group keeps the dialog, unfolds the group and takes the focus', async ({
      page,
    }) => {
      const w = watch(page);
      const panel = await openUniverse(page);
      await panel.getByRole('button', { name: 'Neue Runde starten' }).click();
      const dialog = page.locator('#modal');
      const fee = dialog.locator('#round-market-fee');
      await fee.fill('101');
      await toggle(dialog, 'Marktplatz');
      await expect(fee).toBeHidden();
      await dialog.getByRole('button', { name: 'Ja, neue Runde' }).click();
      await expect(group(dialog, 'Marktplatz')).toHaveAttribute('open', '');
      await expect(fee).toBeFocused();
      await expect(fee).toHaveAttribute('aria-invalid', 'true');
      await expect(lastToast(page)).toContainText('Marktplatz Gebühr');
      await expect(dialog).toBeVisible();
      expect(w.problems).toEqual([]);
    });
  });
}
