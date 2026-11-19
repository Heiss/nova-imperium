// The fleet form (#68): max, all and no ships, „alles“ cargo, too little
// Promethium, and all fleet slots used.
import { expect, test } from '@playwright/test';
import { lastToast, register, seed, uniqueName, watch } from './helpers.ts';
import { shipCount } from './fleet-helpers.ts';

test.describe('fleet and battle (#68)', () => {
  test('the fleet form: max, all and no ships, „alles“ cargo, too little Promethium, all fleet slots used', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Slots');
    await register(page, name);
    seed({
      name,
      ships: { sc: 2, lf: 3 },
      res: { m: 6000, c: 50000, d: 0 },
      colony: {},
    });
    await page.goto('/?view=fleet');
    await expect(page.locator('.box .hd').first()).toHaveText(
      'Flotten unterwegs (0 / 1 Slots)',
    );
    const sc = page.getByLabel('Anzahl Frachtläufer');
    const lf = page.getByLabel('Anzahl Abfangjäger');
    await page.locator('[data-act=fmax][data-k=sc]').click();
    await expect(sc).toHaveValue('2');
    await expect(lf).toHaveValue('');
    await page.getByText('alle Schiffe', { exact: true }).click();
    await expect(lf).toHaveValue('3');
    await page.getByText('keine Schiffe', { exact: true }).click();
    await expect(sc).toHaveValue('');
    await expect(lf).toHaveValue('');
    await page.getByText('alle Schiffe', { exact: true }).click();
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    // Holds of 2 × 5,000 + 3 × 50, filled evenly (#240): no Promethium, so
    // Adamant and Psikristall take half each.
    await page.getByText('alles (gleichmäßig)', { exact: true }).click();
    await expect(page.getByLabel('Adamant', { exact: true })).toHaveValue(
      '5075',
    );
    await expect(page.getByLabel('Psikristall', { exact: true })).toHaveValue(
      '5075',
    );
    await expect(page.getByLabel('Promethium', { exact: true })).toHaveValue(
      '0',
    );
    await expect(page.locator('#i_cap')).toHaveText('10.150 / 10.150');
    await expect(page.locator('#i_fuel .bad')).toBeVisible();
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Nicht genug Promethium für Treibstoff und Ladung.',
    );
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('2');

    seed({ name, res: { m: 6000, c: 50000, d: 1000 } });
    await page.reload();
    await sc.fill('1');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_fuel .bad')).toHaveCount(0);
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    // Kogitator-Doktrin 0: one slot.
    await expect(page.locator('.box .hd').first()).toHaveText(
      'Flotten unterwegs (1 / 1 Slots)',
    );
    await expect(
      page.getByRole('button', { name: 'Flotte losschicken' }),
    ).toBeDisabled();
    await expect(
      page.getByText(
        'Alle Flottenslots belegt (Kogitator-Doktrin erhöht die Anzahl).',
      ),
    ).toBeVisible();
    // A second flight, as from another device that still shows the button.
    const refused = await page.evaluate(async () => {
      const value = (id: string) =>
        Number((document.getElementById(id) as HTMLInputElement).value);
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'send',
          ships: { lf: 1 },
          to: { g: value('t_g'), s: value('t_s'), p: 15 },
          mission: 'transport',
          pct: 10,
          cargo: { m: 0, c: 0, d: 0 },
        }),
      });
      return ((await r.json()) as { error?: string }).error;
    });
    expect(refused).toBe('Alle Flottenslots belegt.');
    expect(w.problems).toEqual([]);
  });
});
