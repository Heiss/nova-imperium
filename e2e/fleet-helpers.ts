// Helpers of the fleet and battle specs: sending, spying, attacking and
// reading the reports of both sides.
import { expect, type Locator, type Page } from '@playwright/test';
import {
  galaxyAction,
  galaxyRow,
  lastToast,
  logout,
  nav,
  register,
  seed,
} from './helpers.ts';

/** Opens the galaxy at the home system of another player, from the highscore. */
export async function openSystemOf(page: Page, player: string): Promise<void> {
  await nav(page, 'highscore');
  await page
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: player, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

/** The count of a ship in the fleet view of the active planet. */
export const shipCount = (page: Page, ship: string): Locator =>
  page
    .locator('tr')
    .filter({ has: page.locator('input.fs'), hasText: ship })
    .locator('td.n')
    .first();

export const report = (page: Page, title: string | RegExp): Locator =>
  page.locator('.rep').filter({ has: page.locator('.t', { hasText: title }) });

/** Sends a Frachtläufer with 1,000 Adamant to the own colony on slot 15. */
export async function sendTransport(page: Page): Promise<void> {
  await page.goto('/?view=fleet');
  await page.getByLabel('Anzahl Frachtläufer').fill('1');
  await page.getByLabel('Position', { exact: true }).fill('15');
  await page.getByLabel('Auftrag').selectOption('transport');
  await page.locator('#c_m').fill('1000');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
  await expect(page.locator('.fl-transport')).toContainText('1 Frachtläufer');
  // The row shows what the fleet carries (#259).
  await expect(page.locator('.fl-transport')).toContainText(
    'Versorgungsflug · Ladung: Adamant 1.000 · Psikristall 0 · Promethium 0',
  );
}

/**
 * Registers a defender and an attacker; the attacker (logged in afterwards)
 * sends 5 Abfangjäger and 2 Frachtläufer against the defender's home planet,
 * and the fleet arrives now.
 */
export async function attack(page: Page, a: string, b: string): Promise<void> {
  await register(page, b);
  await logout(page);
  await register(page, a);
  seed({ name: a, ships: { lf: 5, sc: 2 }, res: { m: 0, c: 0, d: 10000 } });
  // Mines and a probe give the defender a fifth of the attacker's points
  // (no noob protection); the probe dies in the first round.
  seed({
    name: b,
    b: { metal: 12, crystal: 10 },
    ships: { probe: 1 },
    res: { m: 50000, c: 50000, d: 50000 },
  });
  await openSystemOf(page, b);
  await expect(galaxyRow(page, b)).not.toContainText('(n)');
  await (await galaxyAction(page, galaxyRow(page, b), 'Sturmangriff')).click();
  await expect(page.getByLabel('Auftrag')).toHaveValue('attack');
  await page.getByLabel('Anzahl Abfangjäger').fill('5');
  await page.getByLabel('Anzahl Frachtläufer').fill('2');
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
  await expect(page.locator('.fl-attack')).toContainText('Sturmangriff');
  seed({ name: a, landFleet: 'attack' });
}
