// The cargo buttons of the fleet form (#240, owner 2026-11-16): „alles
// (gleichmäßig)“ after the fields fills the holds evenly, and the „alles“
// under each field loads only its resource, up to the room the other two
// fields leave. Promethium counts after the fuel. Two Frachtläufer carry
// 10,000; the colony at position 15 is the target.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { register, seed, uniqueName, watch } from './helpers.ts';

/** axe (WCAG 2.1 A and AA) as in e2e/a11y.spec.ts: the violations of the page. */
async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const field = (page: Page, name: string) =>
  page.getByLabel(name, { exact: true });

const all = (page: Page, name: string) =>
  page.getByRole('button', { name: `Alles ${name}`, exact: true });

/** The fleet form with both Frachtläufer, a transport to the colony. */
async function openForm(page: Page): Promise<void> {
  await page.goto('/?view=fleet');
  await page.getByText('alle Schiffe', { exact: true }).click();
  await field(page, 'Position').fill('15');
  await page.getByLabel('Auftrag').selectOption('transport');
  await expect(page.locator('#i_cap')).toHaveText('0 / 10.000');
}

/** The fuel of the flight the form shows, in Promethium. */
async function fuel(page: Page): Promise<number> {
  const text = await page.locator('#i_fuel').innerText();
  expect(text).toMatch(/^[\d.]+ Promethium$/);
  return Number(text.replace(/\D/g, ''));
}

async function cargoButtons(page: Page): Promise<void> {
  const w = watch(page);
  const name = uniqueName('Ladung');
  await register(page, name);
  seed({
    name,
    ships: { sc: 2 },
    res: { m: 20000, c: 20000, d: 20000 },
    colony: {},
  });
  await openForm(page);
  const f = await fuel(page);
  expect(f).toBeGreaterThan(0);

  // More of every resource than fits: a third each; the extra unit goes to
  // Promethium, which has the least left after the fuel.
  await page.getByText('alles (gleichmäßig)', { exact: true }).click();
  await expect(field(page, 'Adamant')).toHaveValue('3333');
  await expect(field(page, 'Psikristall')).toHaveValue('3333');
  await expect(field(page, 'Promethium')).toHaveValue('3334');
  await expect(page.locator('#i_cap')).toHaveText('10.000 / 10.000');

  // One resource: only its field, up to the room the others leave.
  await field(page, 'Adamant').fill('');
  await field(page, 'Promethium').fill('');
  await field(page, 'Psikristall').fill('4000');
  await all(page, 'Adamant').click();
  await expect(field(page, 'Adamant')).toHaveValue('6000');
  await expect(field(page, 'Psikristall')).toHaveValue('4000');
  await expect(field(page, 'Promethium')).toHaveValue('');
  await all(page, 'Promethium').click();
  await expect(field(page, 'Promethium')).toHaveValue('0');
  await field(page, 'Adamant').fill('');
  await all(page, 'Promethium').click();
  await expect(field(page, 'Promethium')).toHaveValue('6000');
  await expect(field(page, 'Adamant')).toHaveValue('');
  await expect(field(page, 'Psikristall')).toHaveValue('4000');
  await all(page, 'Psikristall').click();
  await expect(field(page, 'Psikristall')).toHaveValue('4000');
  await expect(page.locator('#i_cap')).toHaveText('10.000 / 10.000');
  expect(await violations(page)).toEqual([]);

  // Little Adamant and Promethium: Psikristall takes the rest, Promethium
  // never more than the stock without the fuel.
  seed({ name, res: { m: 1000, c: 20000, d: 500 } });
  await page.reload();
  await openForm(page);
  await all(page, 'Promethium').click();
  await expect(field(page, 'Promethium')).toHaveValue(String(500 - f));
  await page.getByText('alles (gleichmäßig)', { exact: true }).click();
  await expect(field(page, 'Adamant')).toHaveValue('1000');
  await expect(field(page, 'Psikristall')).toHaveValue(String(8500 + f));
  await expect(field(page, 'Promethium')).toHaveValue(String(500 - f));
  await expect(page.locator('#i_fuel .bad')).toHaveCount(0);
  await page.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Flotte unterwegs nach',
  );
  expect(w.problems).toEqual([]);
}

test.describe('the cargo buttons of the fleet form (#240)', () => {
  test('„alles (gleichmäßig)“ fills evenly, „alles“ under a field only its resource', async ({
    page,
  }) => {
    await cargoButtons(page);
  });

  test('„alles (gleichmäßig)“ fills evenly, „alles“ under a field only its resource, on a phone @phone', async ({
    page,
  }) => {
    await cargoButtons(page);
  });
});
