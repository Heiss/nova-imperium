// The fields of a planet (#51): the home planet, a full planet, the
// Weltenschmiede and the extra fields the admin sets.
import { expect, test } from '@playwright/test';
import { cli, nav, register, seed, uniqueName, watch } from './helpers.ts';
// The display texts of the catalog entries (#113); `text` is a local name below.
import { text as entryText } from '../src/core/text.ts';

test.describe('playing', () => {
  test('a home planet has 163 fields; a full planet refuses a new level (#51)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Felder');
    await register(page, name);
    const diameter = page.locator('.kv tr', { hasText: 'Durchmesser' });
    await expect(diameter.locator('td').nth(1)).toHaveText(
      '12.800 km (0/163 Felder)',
    );
    await nav(page, 'buildings');
    await expect(page.locator('#fields')).toHaveText('Felder: 0 / 163');

    // Every building level takes a field: 162 of 163 leave one free.
    seed({
      name,
      b: { metal: 40, crystal: 40, deut: 40, solar: 42 },
      res: { m: 1e12, c: 1e12, d: 1e12 },
    });
    await page.reload();
    await expect(page.locator('#fields')).toHaveText('Felder: 162 / 163');
    await page.click('[data-act=build][data-k=robot]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    seed({
      name,
      b: { metal: 40, crystal: 40, deut: 40, solar: 42, robot: 1 },
      clearQueue: true,
    });
    await page.reload();
    await expect(page.locator('#fields')).toHaveText('Felder: 163 / 163');
    // The refusal stays, and „Zurückbauen“ (#202) stands beside it: tearing
    // a level down is how a full planet gets a field free again.
    for (const building of ['Adamant-Tiefbohrung', 'Servitorenschmiede']) {
      const act = page
        .locator('.item')
        .filter({ has: page.locator('.nm', { hasText: building }) })
        .locator('.act');
      await expect(act.locator('span')).toHaveText('Keine freien Felder.');
      await expect(act.getByRole('button')).toHaveText('Zurückbauen');
    }
    await expect(page.locator('[data-act=build]')).toHaveCount(0);
    const refused = await page.evaluate(async () => {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'build', key: 'metal' }),
      });
      return ((await r.json()) as { error?: string }).error;
    });
    expect(refused).toBe('Keine freien Felder.');
    await nav(page, 'overview');
    await expect(diameter.locator('td').nth(1)).toHaveText(
      '12.800 km (163/163 Felder)',
    );

    // A planet from before the fields has no limit until the next round.
    seed({ name, unlimited: true });
    await page.reload();
    await expect(diameter.locator('td').nth(1)).toHaveText(
      '12.800 km (163 Felder, unbegrenzt)',
    );
    await nav(page, 'buildings');
    await expect(page.locator('#fields')).toHaveText(
      'Felder: 163 / unbegrenzt',
    );
    await expect(page.locator('[data-act=build][data-k=metal]')).toBeEnabled();
    seed({ name, unlimited: false });
    expect(w.problems).toEqual([]);
  });

  test('the Weltenschmiede needs energy production and adds five fields (#51)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Schmiede');
    await register(page, name);
    // Sonnenkathedrale 13 makes about 897 energy, 14 about 1,063.
    seed({
      name,
      b: { robot: 10, nanite: 8, solar: 13 },
      research: { energy: 12 },
      res: { m: 0, c: 1e6, d: 1e6 },
    });
    await page.goto('/?view=buildings');
    const forge = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Weltenschmiede/ }),
    });
    await expect(
      forge.getByRole('img', { name: 'Weltenschmiede' }),
    ).toHaveAttribute('src', '/icons/buildings/terraformer.svg');
    await expect(forge.locator('.ds')).toHaveText(entryText('terraformer')!.ds);
    await expect(
      forge.getByRole('img', { name: 'Energieproduktion' }),
    ).toBeVisible();
    await expect(forge.locator('.cost b')).toHaveText([
      '50.000',
      '100.000',
      '1.000',
    ]);
    await expect(forge.locator('.cost b').nth(2)).toHaveClass('bad');
    await expect(forge.locator('.act')).toHaveText(
      /^Zu wenig Energie: es fehlen [\d.]+$/,
    );
    const refused = await page.evaluate(async () => {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'build', key: 'terraformer' }),
      });
      return ((await r.json()) as { error?: string }).error;
    });
    expect(refused).toMatch(
      /^Zu wenig Energie: Weltenschmiede braucht eine Energieproduktion von 1\.000, es fehlen [\d.]+\.$/,
    );

    seed({ name, b: { robot: 10, nanite: 8, solar: 14 } });
    await page.reload();
    await expect(page.locator('#fields')).toHaveText('Felder: 32 / 163');
    await expect(forge.locator('.cost b').nth(2)).not.toHaveClass('bad');
    await forge.locator('[data-act=build]').click();
    await expect(forge.locator('.lv')).toHaveText('(Stufe 1)', {
      timeout: 20000,
    });
    // It takes a field itself and adds five; the energy is not used up.
    await expect(page.locator('#fields')).toHaveText('Felder: 33 / 168');
    await expect(forge.locator('.cost b')).toHaveText([
      '100.000',
      '200.000',
      '2.000',
    ]);
    // With a level it can also be torn down again (#202).
    await expect(forge.locator('.act span')).toHaveText(
      /^Zu wenig Energie: es fehlen [\d.]+$/,
    );
    await expect(forge.locator('.act').getByRole('button')).toHaveText(
      'Zurückbauen',
    );
    await nav(page, 'overview');
    await expect(
      page.locator('.kv tr', { hasText: 'Durchmesser' }).locator('td').nth(1),
    ).toHaveText('12.800 km (33/168 Felder)');
    expect(w.problems).toEqual([]);
  });

  test('a full planet and the field count on a phone (#51) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('FelderH');
    await register(page, name);
    await expect(
      page.locator('.kv tr', { hasText: 'Durchmesser' }).locator('td').nth(1),
    ).toHaveText('12.800 km (0/163 Felder)');
    seed({ name, b: { metal: 40, crystal: 40, deut: 40, solar: 43 } });
    await page.reload();
    await nav(page, 'buildings');
    await expect(page.locator('#fields')).toHaveText('Felder: 163 / 163');
    await expect(page.locator('#fields')).toBeInViewport();
    const metal = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Adamant-Tiefbohrung/ }),
    });
    await expect(metal.locator('.act span')).toHaveText('Keine freien Felder.');
    await expect(metal.locator('.act').getByRole('button')).toHaveText(
      'Zurückbauen',
    );
    await expect(metal.locator('.act')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});

test.describe('admin', () => {
  test('the admin gives every planet extra fields (#51, D4)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Zusatz');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    const extra = page.getByLabel('Zusatzfelder pro Planet');
    await expect(extra).toHaveValue('0');
    await extra.fill('101');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Zusatzfelder pro Planet: ganze Zahl von 0 bis 100.',
    );
    try {
      // Inside the try: a failed save or check must still reset the
      // setting that the whole E2E run shares.
      await extra.fill('12');
      await page.click('[data-act=saveSettings]');
      await expect(page.locator('.toast').last()).toContainText(
        'Einstellungen gespeichert.',
      );
      await nav(page, 'buildings');
      await expect(page.locator('#fields')).toHaveText('Felder: 0 / 175');
      await nav(page, 'overview');
      await expect(
        page.locator('.kv tr', { hasText: 'Durchmesser' }).locator('td').nth(1),
      ).toHaveText('12.800 km (0/175 Felder)');
    } finally {
      // The universe is shared by the whole E2E run.
      await nav(page, 'admin');
      await page.getByRole('tab', { name: 'Universum' }).click();
      await extra.fill('0');
      await page.click('[data-act=saveSettings]');
      await expect(page.locator('.toast').last()).toContainText(
        'Einstellungen gespeichert.',
      );
    }
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });
});
