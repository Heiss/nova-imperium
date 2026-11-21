// Transports (#68, #259): the cargo on a phone, unloading on a colony,
// reports deleted, and „Rückruf“.
import { expect, test } from '@playwright/test';
import {
  choosePlanet,
  lastToast,
  nav,
  register,
  seed,
  stock,
  uniqueName,
  watch,
} from './helpers.ts';
import { report, sendTransport, shipCount } from './fleet-helpers.ts';

test.describe('fleet and battle (#68)', () => {
  test('the overview shows the cargo of a transport on a 390 px phone (#259) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('LadungH');
    await register(page, name);
    seed({
      name,
      ships: { sc: 1 },
      res: { m: 5000, c: 0, d: 5000 },
      colony: { res: { m: 0, c: 0, d: 0 } },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await sendTransport(page);
    await nav(page, 'overview');
    const row = page.locator('.fl-transport');
    await expect(row).toContainText('Deine Flotte (1 Frachtläufer) von ');
    await expect(row).toContainText(
      'Versorgungsflug · Ladung: Adamant 1.000 · Psikristall 0 · Promethium 0',
    );
    await expect(row).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(w.problems).toEqual([]);
  });

  test('a transport unloads on the colony and comes home; reports are deleted one by one and all at once', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Fracht');
    await register(page, name);
    seed({
      name,
      ships: { sc: 1 },
      res: { m: 5000, c: 0, d: 5000 },
      colony: { res: { m: 0, c: 0, d: 0 } },
    });
    await sendTransport(page);
    await expect(stock(page, 'Adamant')).toHaveText(/^4\.\d{3}$/);

    seed({ name, landFleet: 'transport' });
    await expect(page.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });
    // Unloaded, it carries nothing home and shows no cargo (#259).
    await expect(page.locator('.fl-back')).not.toContainText('Ladung');
    await choosePlanet(page, 'Kolonie');
    await expect(stock(page, 'Adamant')).toHaveText('1.000');
    seed({ name, returnFleet: true });
    await nav(page, 'messages');
    await expect(page.locator('.box .hd')).toContainText('Berichte (2)', {
      timeout: 15000,
    });
    const arrived = report(page, 'Transport erreicht');
    await arrived.locator('.t').click();
    await expect(arrived).toContainText(
      'und liefert Adamant 1.000 · Psikristall 0 · Promethium 0.',
    );
    const back = report(page, 'Rückkehr zu Heimatplanet');
    await back.locator('.t').click();
    await expect(back).toContainText('Deine Flotte ist zurück.');

    await back.getByText('löschen', { exact: true }).click();
    await expect(page.locator('.box .hd')).toContainText('Berichte (1)');
    await expect(back).toHaveCount(0);
    await expect(arrived).toBeVisible();
    await page.getByRole('button', { name: 'Alle löschen' }).click();
    await expect(page.locator('.box .hd')).toContainText('Berichte (0)');
    await expect(page.getByText('Keine Nachrichten.')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Keine Nachrichten.')).toBeVisible();
    expect(w.problems).toEqual([]);
  });

  test('„Rückruf“ turns a transport back; it brings its cargo home', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Rueckruf');
    await register(page, name);
    seed({
      name,
      ships: { sc: 1 },
      res: { m: 5000, c: 0, d: 5000 },
      colony: { res: { m: 0, c: 0, d: 0 } },
    });
    await sendTransport(page);
    await page.getByRole('button', { name: 'Rückruf' }).click();
    await expect(lastToast(page)).toContainText('Flotte zurückgerufen.');
    await expect(page.locator('.fl-back')).toContainText('kehrt von');
    await expect(page.locator('.fl-back')).toContainText(
      'zurück · Ladung: Adamant 1.000 · Psikristall 0 · Promethium 0',
    );
    await expect(page.locator('.fl-transport')).toHaveCount(0);

    seed({ name, returnFleet: true });
    await expect(page.locator('.fl-back')).toHaveCount(0, { timeout: 15000 });
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('1');
    await nav(page, 'messages');
    await expect(page.locator('.box .hd')).toContainText('Berichte (1)');
    const back = report(page, 'Rückkehr zu Heimatplanet');
    await back.locator('.t').click();
    await expect(back).toContainText(
      'Deine Flotte ist zurück und bringt Adamant 1.000 · Psikristall 0 · Promethium 0 mit.',
    );
    await choosePlanet(page, 'Kolonie');
    await expect(stock(page, 'Adamant')).toHaveText('0');
    expect(w.problems).toEqual([]);
  });
});
