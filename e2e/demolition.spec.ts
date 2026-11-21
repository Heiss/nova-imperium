// Tearing down a building level (#202, okf/features/demolition.md): the
// button „Zurückbauen“ of a building opens a confirmation with what comes
// back at the factor of the round (+50 % by default) and the new level; the
// order runs in the build queue as „Rückbau auf Stufe …“, „Abbrechen“ keeps
// the level, and at its end the level is one lower. Desktop and phone, with
// axe on the confirmation.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  nav,
  openAllRows,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** The row of a building in the list „Gebäude“. */
const row = (page: Page, name: string): Locator =>
  page.locator('.item').filter({ hasText: name });

async function demolitionFlow(page: Page): Promise<void> {
  const { problems } = watch(page);
  const player = uniqueName('Rueckbau');
  await register(page, player);
  seed({ name: player, b: { metal: 2 }, res: { m: 1000, c: 1000, d: 0 } });
  await page.reload();
  await nav(page, 'buildings');
  await openAllRows(page);
  const mine = row(page, 'Adamant-Tiefbohrung');
  await expect(mine.locator('.lv')).toHaveText('(Stufe 2)');
  // Only a building with a level offers it.
  await expect(
    row(page, 'Psikristall-Steinbruch').getByRole('button', {
      name: 'Zurückbauen',
    }),
  ).toHaveCount(0);

  await mine.getByRole('button', { name: 'Zurückbauen' }).click();
  const dialog = page.locator('#modal');
  await expect(dialog).toContainText(
    'Adamant-Tiefbohrung: Rückbau auf Stufe 1',
  );
  // Level 2 costs 90 Adamant and 22 Psikristall; +50 % of it, rounded down.
  await expect(dialog).toContainText(
    'Du erhältst 45 Adamant, 11 Psikristall, 0 Promethium zurück (Erstattung 50 %).',
  );
  expect(await violations(page)).toEqual([]);
  await dialog.getByRole('button', { name: 'Zurückbauen' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(mine).toContainText('Rückbau auf Stufe 1');
  // The queue is busy: no other building offers it meanwhile.
  await expect(page.getByRole('button', { name: 'Zurückbauen' })).toHaveCount(
    0,
  );

  // „Abbrechen“ keeps the level.
  await mine.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(mine).not.toContainText('Rückbau auf Stufe 1');
  await expect(mine.locator('.lv')).toHaveText('(Stufe 2)');

  // Again, and the order ends: one level lower.
  await mine.getByRole('button', { name: 'Zurückbauen' }).click();
  await dialog.getByRole('button', { name: 'Zurückbauen' }).click();
  await expect(mine).toContainText('Rückbau auf Stufe 1');
  seed({ name: player, finishBuild: true });
  await page.reload();
  await nav(page, 'buildings');
  await expect(mine.locator('.lv')).toHaveText('(Stufe 1)');
  await expect(mine).not.toContainText('Rückbau auf Stufe');
  expect(problems).toEqual([]);
}

test('a building level is torn down for the refund of the round (#202)', async ({
  page,
}) => {
  await demolitionFlow(page);
});

test('a building level is torn down on the phone (#202) @phone', async ({
  page,
}) => {
  await demolitionFlow(page);
});
