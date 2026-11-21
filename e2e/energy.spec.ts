// Energy: Solarsatelliten (#46), the Fusionskraftwerk (#47), a full store
// and a shortage of energy (#68).
import { expect, test } from '@playwright/test';
import { register, seed, stock, uniqueName, watch } from './helpers.ts';

test.describe('playing', () => {
  test('Solarsatelliten give energy by temperature and never fly (#46)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Sat');
    await register(page, name);
    seed({ name, b: { yard: 1 }, temp: 8, res: { m: 0, c: 10000, d: 10000 } });
    await page.goto('/?view=shipyard');
    const item = page
      .locator('.item')
      .filter({ has: page.locator('.nm', { hasText: /^\s*Sonnenreliquiar/ }) });
    await expect(
      item.getByRole('img', { name: 'Sonnenreliquiar' }),
    ).toHaveAttribute('src', '/icons/ships/solar_satellite.svg');
    await expect(item).toContainText('Energie 22 je Reliquiar');
    await expect(item).not.toContainText('Tempo');
    await page.fill('#q_sat', '2');
    await page.click('[data-act=order][data-k=sat]');
    await expect(
      page.locator('.box', { hasText: 'Bauauftrag der Schiffsschmiede' }),
    ).toContainText('2× Sonnenreliquiar');

    seed({ name, ships: { sat: 3, lf: 1 }, temp: 8 });
    await page.goto('/?view=resources');
    const row = page.locator('tr', { hasText: 'Sonnenreliquiare (3)' });
    await expect(row.locator('td.good')).toHaveText('66');
    await page.selectOption('select[data-k=sat]', '50');
    await expect(row.locator('td.good')).toHaveText('33');
    await page.goto('/?view=fleet');
    await expect(page.locator('#f_lf')).toBeVisible();
    await expect(page.locator('#f_sat')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });

  test('the Fusionskraftwerk burns deuterium for energy and is throttled at an empty stock (#47)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Fusion');
    await register(page, name);
    seed({ name, res: { m: 10000, c: 10000, d: 10000 } });
    await page.goto('/?view=buildings');
    const item = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Fusionssanktum/ }),
    });
    await expect(
      item.getByRole('img', { name: 'Fusionssanktum' }),
    ).toHaveAttribute('src', '/icons/buildings/fusion_reactor.svg');
    await expect(item.locator('.cost').first()).toHaveText(/900.*360.*180/);
    await expect(item.locator('.needs')).toContainText('Promethium-Raffinerie');
    await expect(item.locator('.needs')).toContainText('Machina-Energetik');
    await expect(item.locator('.act')).toContainText(
      'Das Wissen ist noch verschlossen',
    );
    seed({
      name,
      b: { deut: 5, lab: 1 },
      research: { energy: 3 },
      clearQueue: true,
    });
    await page.reload();
    await expect(item.locator('.needs')).toHaveCount(0);
    await expect(item).toContainText(
      'Promethiumverbrauch auf Stufe 1: 55 pro Stunde',
    );
    await expect(page.locator('[data-act=build][data-k=fusion]')).toBeEnabled();

    // Level 3 with Energietechnik 3: 90 · 1.08³ ≈ 113 energy, and
    // 30 · 1.1³ · speed 5 ≈ 199.7 deuterium per hour.
    seed({
      name,
      b: { deut: 9, fusion: 3 },
      research: { energy: 3 },
      temp: 20,
      res: { m: 0, c: 0, d: 50000 },
    });
    await page.goto('/?view=resources');
    const row = page.locator('tr', { hasText: 'Fusionssanktum (Stufe 3)' });
    await expect(row.locator('td.good')).toHaveText('113');
    await expect(row.locator('td.bad')).toHaveText('-199');
    await expect(row).not.toContainText('gedrosselt');
    // Energy in total: 113.4 minus 20 · 9 · 1.1⁹ ≈ 424.4 for the mine.
    const sum = page.locator('tr', { hasText: 'Summe / Stunde' });
    await expect(sum.locator('th').nth(4)).toHaveText('-312');
    await page.selectOption('select[data-k=fusion]', '50');
    await expect(row.locator('td.good')).toHaveText('56');
    await expect(row.locator('td.bad')).toHaveText('-99');

    // Deuterium 5 makes about 499 per hour, the reactor 8 wants about 857:
    // with an empty stock it runs at about 58 % and the stock stays at 0.
    seed({
      name,
      b: { deut: 5, fusion: 8 },
      research: { energy: 3 },
      temp: 20,
      res: { m: 0, c: 0, d: 0 },
      pct: {},
    });
    await page.reload();
    const dry = page.locator('tr', { hasText: 'Fusionssanktum (Stufe 8)' });
    await expect(dry).toContainText('gedrosselt auf 58 %');
    await expect(dry.locator('select[data-k=fusion]')).toHaveValue('100');
    await expect(sum.locator('th').nth(3)).toHaveText('0');
    await expect(stock(page, 'Promethium')).toHaveText('0');
    expect(w.problems).toEqual([]);
  });
});

test.describe('push and economy (#68)', () => {
  test('a full store stops its production; too little energy lowers the mines', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Lager');
    await register(page, name);
    // One hour without mines at speed 5: 100 Adamant and 50 Psikristall of
    // base income; the Adamant store (100.000) is full already.
    seed({
      name,
      res: { m: 100000, c: 0, d: 0 },
      settledAgo: 3600 * 1000,
    });
    await page.reload();
    await expect(stock(page, 'Adamant')).toHaveText('100.000');
    await expect(stock(page, 'Adamant')).toHaveClass(/full/);
    await expect(stock(page, 'Psikristall')).toHaveText('50');
    await expect(stock(page, 'Psikristall')).not.toHaveClass(/full/);

    // Mine 10 needs 259 energy, solar 5 gives 161: factor 62 %, Adamant
    // (20 + 30 · 10 · 1.1¹⁰ · 0.62) · 5 = 2,515 per hour; solar 7 gives 272.
    const sum = page.locator('tr', { hasText: 'Summe / Stunde' });
    seed({ name, b: { metal: 10, solar: 5 } });
    await page.goto('/?view=resources');
    await expect(page.locator('.box .hd')).toHaveText(
      'Produktion pro Stunde (Produktionsfaktor 62 %)',
    );
    await expect(sum.locator('th').nth(1)).toHaveText('2.515');
    await expect(stock(page, 'Energie')).toHaveText('-99/161');
    await expect(stock(page, 'Energie')).toHaveClass(/bad/);
    seed({ name, b: { metal: 10, solar: 7 } });
    await page.reload();
    await expect(page.locator('.box .hd')).toHaveText(
      'Produktion pro Stunde (Produktionsfaktor 100 %)',
    );
    await expect(sum.locator('th').nth(1)).toHaveText('3.990');
    await expect(stock(page, 'Energie')).not.toHaveClass(/bad/);
    expect(w.problems).toEqual([]);
  });
});
