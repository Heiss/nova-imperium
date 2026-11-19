// The expeditions (#93, okf/features/expeditions.md): with
// Kreuzzugs-Kartografie the Sternenkarte shows the expedition position after
// the last planet position of every system with the button „Expedition“; the
// fleet form asks for the hours of the stay, refuses more than the level
// allows, and the fleet flies there. The event itself is not decided yet, so
// the report says that nothing was found. Written, not run in the session
// that built it (the owner's rule: the CI runs the E2E suite).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { nav, register, seed, uniqueName, watch } from './helpers.ts';

const lastToast = (page: Page): Locator => page.locator('.toast').last();

async function homeSystem(page: Page): Promise<void> {
  await nav(page, 'galaxy');
  await page.getByText('zum Heimatsystem').click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

test.describe('the expedition (#93)', () => {
  test('offers the expedition position, takes the hours of the stay and sends the fleet', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Entdecker');
    await register(page, name);
    seed({
      name,
      ships: { lc: 5 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    await page.reload();

    // Without the research the position is there, but offers no expedition.
    await homeSystem(page);
    const row = page.locator('table.gal tr', {
      hasText: 'Expeditionsposition',
    });
    await expect(row).toHaveCount(1);
    await expect(row.locator('td.n')).toHaveText('16');
    await expect(row.getByRole('button', { name: 'Expedition' })).toHaveCount(
      0,
    );

    seed({ name, research: { expo: 4 } });
    await page.reload();
    await homeSystem(page);
    await row.getByRole('button', { name: 'Expedition' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('expedition');
    await expect(page.getByLabel('Position', { exact: true })).toHaveValue(
      '16',
    );
    await expect(page.locator('#t_info')).toHaveText('Expeditionsposition');
    await expect(page.getByLabel('Haltezeit in Stunden')).toBeVisible();
    await expect(page.getByText(/Expeditionen \(0 \/ 2\)/)).toBeVisible();

    // More hours than the level allows are refused with the most.
    await page.getByLabel('Anzahl Lastbarke').fill('2');
    await page.getByLabel('Haltezeit in Stunden').fill('9');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText(
      'Die Haltezeit beträgt höchstens 4 Stunden.',
    );

    // A stay of two hours: the fleet flies, and the form shows the stay in its times.
    await page.getByLabel('Haltezeit in Stunden').fill('2');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await nav(page, 'overview');
    await expect(page.locator('.fl-expedition')).toContainText('Expedition');
    await expect(page.locator('.fl-expedition')).toContainText('2 Lastbarke');

    // Another mission may not fly there.
    await page.goto('/?view=fleet');
    await page.getByLabel('Anzahl Lastbarke').fill('1');
    await page.getByLabel('Position', { exact: true }).fill('16');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#t_info')).toHaveText('nur für Expeditionen');
    await expect(page.getByLabel('Haltezeit in Stunden')).toBeHidden();

    // The stay ends: nothing is decided to happen yet, so the report says so.
    seed({ name, landFleet: 'expedition' });
    await nav(page, 'messages');
    const report = page.locator('.rep').filter({
      has: page.locator('.t', { hasText: /Expedition \[\d+:\d+:16\] – / }),
    });
    await expect(report).toHaveCount(1, { timeout: 15000 });
    await report.locator('.t').click();
    await expect(report).toContainText(
      'Die Expedition hat nichts Besonderes gefunden und kehrt heim.',
    );
    expect(w.problems).toEqual([]);
  });
});
