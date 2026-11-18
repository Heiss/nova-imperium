// The Vermessung (#190, okf/features/survey.md): with Auspex-Kartographie the
// Sternenkarte offers „Vermessen“ at a free position; the probes fly there and
// the report shows the planet; a second survey with more probes from the
// fleet form shows the same values, and the colony founded there has them.
// The research is seeded at a high level, so the loss chance stays below
// 0.1 % and the test does not depend on it (the tiers and the loss are unit
// tests of src/core/survey.ts and the mission folder).
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  expectShownPlace,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const lastToast = (page: Page): Locator => page.locator('.toast').last();
const reports = (page: Page, title: string): Locator =>
  page.locator('.rep').filter({ has: page.locator('.t', { hasText: title }) });

async function homeSystem(page: Page): Promise<void> {
  await nav(page, 'galaxy');
  await page.getByText('zum Heimatsystem').click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

/** The value of a row of the open report table. */
const cell = (r: Locator, label: string): Promise<string | null> =>
  r
    .locator('tr', {
      has: r.page().getByRole('cell', { name: label, exact: true }),
    })
    .first()
    .locator('td')
    .nth(1)
    .textContent();

test.describe('the Vermessung (#190)', () => {
  test('surveys a free position with one and with five probes, then colonizes it with the surveyed values', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Vermesser');
    await register(page, name);
    seed({
      name,
      ships: { probe: 10, colony: 1 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    await page.reload();
    // Without Auspex-Kartographie the Sternenkarte offers no survey.
    await homeSystem(page);
    await expect(
      page.getByRole('button', { name: 'Landnahme' }),
    ).not.toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Vermessen' })).toHaveCount(
      0,
    );

    seed({ name, research: { carto: 100 } });
    await page.reload();
    await homeSystem(page);
    const button = page.getByRole('button', { name: 'Vermessen' }).first();
    const [g, s, p] = await Promise.all(
      ['data-g', 'data-s', 'data-p'].map((a) => button.getAttribute(a)),
    );
    const at = `[${g}:${s}:${p}]`;
    await button.click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await nav(page, 'overview');
    await expect(page.locator('.fl-survey')).toContainText('Vermessung');
    await expect(page.locator('.fl-survey')).toContainText('1 Spähschädel');
    seed({ name, landFleet: 'survey' });
    await expect(page.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });

    await nav(page, 'messages');
    const first = reports(page, `Vermessungsbericht ${at}`);
    await expect(first).toHaveCount(1);
    await first.locator('.t').click();
    await expect(first).toContainText(`Vermessung ${at}.`);
    for (const label of [
      'Promethium-Faktor',
      'Energie je Sonnenreliquiar',
      'Vorteile',
      'Nachteile',
      'Planetentyp',
    ])
      await expect(first).toContainText(label);
    const temp = (await cell(first, 'Temperatur'))!;
    const diameter = (await cell(first, 'Durchmesser'))!;
    const fields = (await cell(first, 'Felder'))!;
    const [, low, high] = /^(-?\d+) °C bis (-?\d+) °C$/.exec(temp)!;
    expect(Number(high) - Number(low)).toBe(40);
    expect(diameter).toMatch(/^[\d.]+ km$/);
    const [, count] = /^(\d+) \(Position \d+: /.exec(fields)!;

    // Five probes from the fleet form: the same values.
    seed({ name, returnFleet: true });
    await page.goto('/?view=fleet');
    await page.getByLabel('Anzahl Spähschädel').fill('5');
    await page.getByLabel('Galaxie', { exact: true }).fill(g!);
    await page.getByLabel('System', { exact: true }).fill(s!);
    await page.getByLabel('Position', { exact: true }).fill(p!);
    await page.getByLabel('Auftrag').selectOption('survey');
    await expect(page.locator('#t_info')).toHaveText('Freie Position');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    seed({ name, landFleet: 'survey' });
    await nav(page, 'messages');
    const both = reports(page, `Vermessungsbericht ${at}`);
    await expect(both).toHaveCount(2, { timeout: 15000 });
    const second = both.first();
    await second.locator('.t').click();
    expect(await cell(second, 'Temperatur')).toBe(temp);
    expect(await cell(second, 'Durchmesser')).toBe(diameter);
    expect(await cell(second, 'Felder')).toBe(fields);

    // The colony founded there has the surveyed values, once the slot is free.
    seed({ name, returnFleet: true });
    await nav(page, 'overview');
    await expect(page.locator('.fl-back')).toHaveCount(0, { timeout: 15000 });
    await homeSystem(page);
    await page
      .locator(`button[data-act=gfleet][data-m=colonize][data-p="${p}"]`)
      .click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('colonize');
    await page.getByLabel('Anzahl Kolonistenarche').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs');
    seed({ name, landColonyFleet: true });
    const selector = page.getByLabel('Aktiver Planet');
    const colony = selector.locator('option').filter({ hasText: at });
    await expect(colony).toHaveCount(1, { timeout: 15000 });
    await selector.selectOption((await colony.getAttribute('value'))!);
    await expectShownPlace(page, 'Kolonie');
    await nav(page, 'overview');
    await expect(
      page.locator('.kv tr', { hasText: 'Temperatur' }),
    ).toContainText(`ca. ${low}°C bis ${high}°C`);
    await expect(
      page.locator('.kv tr', { hasText: 'Durchmesser' }),
    ).toContainText(`${diameter} (0/${count} Felder)`);
    expect(w.problems).toEqual([]);
  });
});
