// Defense (#50, #64): Ionengeschütz, Plasmawerfer and the shield domes, with
// icons and requirements on a phone.
import { expect, test } from '@playwright/test';
import { openAllRows, register, seed, uniqueName, watch } from './helpers.ts';

test.describe('playing', () => {
  test('Ionengeschütz, Plasmawerfer and the shield domes; a dome only once (#50)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Kuppel');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 8, lab: 7 },
      research: { energy: 8, laser: 10, ion: 5, plasma: 6, shield: 6 },
      def: { lsd: 1 },
      res: { m: 500000, c: 500000, d: 100000 },
    });
    await page.goto('/?view=defense');
    await openAllRows(page);
    const item = (nm: string) =>
      page.locator('.item').filter({
        has: page.locator('.nm', { hasText: new RegExp(`^\\s*${nm}`) }),
      });
    const units = [
      ['Ionenlanze', 'ion_cannon', 'Angriff 150 · Schild 800 · Struktur 8.000'],
      [
        'Plasmabatterie',
        'plasma_turret',
        'Angriff 3.000 · Schild 480 · Struktur 100.000',
      ],
      [
        'Kleiner Schutzdom',
        'small_shield_dome',
        'Angriff 1 · Schild 3.200 · Struktur 20.000',
      ],
      [
        'Großer Schutzdom',
        'large_shield_dome',
        'Angriff 1 · Schild 16.000 · Struktur 100.000',
      ],
    ] as const;
    for (const [nm, file, stats] of units) {
      await expect(item(nm).getByRole('img', { name: nm })).toHaveAttribute(
        'src',
        `/icons/defense/${file}.svg`,
      );
      await expect(item(nm)).toContainText(stats);
    }
    // Plasmatechnik 6 of 7: the Plasmawerfer lists what is missing.
    const pt = item('Plasmabatterie');
    await expect(
      pt.locator('.need-nm', { hasText: /^Plasma-Lehre$/ }),
    ).toBeVisible();
    await expect(pt.locator('[data-act=order]')).toHaveCount(0);
    await expect(item('Ionenlanze').locator('.needs')).toHaveCount(0);
    await expect(item('Ionenlanze').locator('.lv')).toHaveText(
      '(vorhanden: 0)',
    );

    const small = item('Kleiner Schutzdom');
    const large = item('Großer Schutzdom');
    await expect(small.locator('.lv')).toHaveText('(vorhanden: 0 · max. 1)');
    await expect(small.locator('[data-act=maxq]')).toHaveText('(max 1)');
    await expect(large.locator('.lv')).toHaveText('(vorhanden: 1 · max. 1)');
    await expect(large.locator('[data-act=maxq]')).toHaveText('(max 0)');
    await expect(large.locator('[data-act=order]')).toBeDisabled();

    const refused = 'Diesen Schutzdom gibt es nur einmal pro Planet.';
    await page.fill('#q_ssd', '2');
    await page.click('[data-act=order][data-k=ssd]');
    await expect(page.locator('.toast').last()).toContainText(refused);
    await page.fill('#q_ssd', '1');
    await page.click('[data-act=order][data-k=ssd]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Kleiner Schutzdom in Auftrag gegeben.',
    );
    await expect(
      page.locator('.box', { hasText: 'Bauauftrag der Schiffsschmiede' }),
    ).toContainText('1× Kleiner Schutzdom');
    await expect(small.locator('[data-act=maxq]')).toHaveText('(max 0)');
    await expect(small.locator('[data-act=order]')).toBeDisabled();
    // A second order, as from another device that still shows the button.
    const second = await page.evaluate(async () => {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'order', key: 'ssd', n: 1 }),
      });
      return { ok: r.ok, body: (await r.json()) as { error?: string } };
    });
    expect(second).toEqual({ ok: false, body: { error: refused } });
    expect(w.problems).toEqual([]);
  });

  test('defense shows the new units with icons and requirements on a phone (#50) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Schild');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 1, lab: 1 },
      research: { shield: 2 },
      res: { m: 20000, c: 20000, d: 0 },
    });
    await page.goto('/?view=defense');
    await openAllRows(page);
    const item = (nm: string) =>
      page.locator('.item').filter({
        has: page.locator('.nm', { hasText: new RegExp(`^\\s*${nm}`) }),
      });
    for (const nm of [
      'Ionenlanze',
      'Plasmabatterie',
      'Kleiner Schutzdom',
      'Großer Schutzdom',
    ])
      await expect(item(nm).getByRole('img', { name: nm })).toBeVisible();
    await expect(
      item('Ionenlanze').locator('.need-nm', { hasText: /^Ionen-Lehre$/ }),
    ).toBeVisible();
    await expect(
      item('Großer Schutzdom').locator('.need-nm', {
        hasText: /^Refraktionsfelder$/,
      }),
    ).toBeVisible();
    const small = item('Kleiner Schutzdom');
    await expect(small.locator('.needs')).toHaveCount(0);
    await expect(small).toContainText('max. 1');
    await expect(small.locator('[data-act=order]')).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('defense lists requirements with reasons on a phone (#64) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Wall');
    await register(page, name);
    seed({ name, b: { robot: 2, yard: 2, lab: 1 } });
    await page.goto('/?view=defense');
    await openAllRows(page);
    const light = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Lichtlanze/ }),
    });
    const energy = light.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Machina-Energetik$/ }),
    });
    await expect(energy).toHaveClass(/missing/);
    await expect(energy).toContainText('zu wenig Psikristall, Promethium');
    await expect(
      light.locator('.need').filter({
        has: page.locator('.need-nm', { hasText: /^Lichtlanzen-Lehre$/ }),
      }),
    ).toContainText('braucht Machina-Energetik (Stufe 2)');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});
