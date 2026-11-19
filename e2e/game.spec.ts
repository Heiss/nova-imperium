import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  choosePlanet,
  cli,
  nav,
  register,
  seconds,
  seed,
  uniqueName,
  watch,
  withWebPush,
} from './helpers.ts';
import { shipCount } from './fleet-helpers.ts';
// The display texts of the catalog entries (#113); `text` is a local name below.
import { text as entryText } from '../src/core/text.ts';

/** The paragraphs of a long text (#94): the lore, then „So funktioniert es:“. */
const lines = (text: string): string[] => text.split('\n\n');

test.describe('playing', () => {
  test('ships are ordered, a fleet flies, spies and comes home', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Flotte');
    const b = uniqueName('Ziel');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    seed({
      name: a,
      b: { yard: 3, robot: 2, metal: 10 },
      research: { comb: 3, spy: 2 },
      ships: { probe: 2, sc: 3 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    seed({ name: b, b: { metal: 12 } });
    await page.reload();
    await nav(page, 'shipyard');
    await page.fill('#q_lf', '2');
    await page.click('[data-act=order][data-k=lf]');
    await expect(page.locator('.toast').last()).toContainText(
      '2× Abfangjäger in Auftrag gegeben.',
    );
    await nav(page, 'fleet');
    await page.fill('#f_sc', '1');
    await expect(page.locator('#i_cap')).toContainText('5.000');
    await page.click('[data-act=send]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'dein eigener Planet',
    );
    await nav(page, 'highscore');
    const target = page.locator('tr', { hasText: b }).locator('[data-act=gto]');
    await target.click();
    await expect(page.locator('h2')).toHaveText('Sternenkarte');
    await page.locator('tr', { hasText: b }).locator('[data-act=gspy]').click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await nav(page, 'overview');
    await expect(page.locator('.fl-spy')).toContainText('Auspex-Erkundung');
    await expect(page.locator('#menu [data-v=messages] .badge')).toBeVisible({
      timeout: 30000,
    });
    await nav(page, 'messages');
    await page
      .locator('.rep .t', { hasText: 'Auspex-Bericht' })
      .first()
      .click();
    await expect(page.locator('.rep.open')).toContainText('Rohstoffe auf');
    // The target registered just now: its activity, by the rule of #229 (#175 D5).
    await expect(
      page.locator('.rep.open .mt', { hasText: 'Aktivität' }),
    ).toHaveText(/^Aktivität\s*Aktiv$/);
    expect(w.problems).toEqual([]);
  });

  test('Schlachtkreuzer and Zerstörer are built and fly (#58, #59)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Fregatte');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 9, lab: 7 },
      research: { energy: 5, shield: 5, laser: 12, hyper: 5, hdrive: 6 },
      ships: { bc: 2, dr: 1 },
      res: { m: 200000, c: 200000, d: 100000 },
      colony: {},
    });
    await page.goto('/?view=shipyard');
    const item = (nm: string) =>
      page.locator('.item').filter({
        has: page.locator('.nm', { hasText: new RegExp(`^\\s*${nm}`) }),
      });
    const bc = item('Jagdkreuzer');
    const dr = item('Vernichter');
    await expect(bc.getByRole('img', { name: 'Jagdkreuzer' })).toHaveAttribute(
      'src',
      '/icons/ships/battlecruiser.svg',
    );
    await expect(dr.getByRole('img', { name: 'Vernichter' })).toHaveAttribute(
      'src',
      '/icons/ships/destroyer.svg',
    );
    await expect(bc).toContainText(
      'Angriff 700 · Schild 600 · Struktur 70.000 · Ladung 750 · Tempo 28.000',
    );
    await expect(dr).toContainText(
      'Angriff 2.000 · Schild 750 · Struktur 110.000 · Ladung 2.000 · Tempo 14.000',
    );
    await expect(bc.locator('.needs')).toHaveCount(0);
    await expect(dr.locator('.needs')).toHaveCount(0);
    await page.fill('#q_bc', '1');
    await page.click('[data-act=order][data-k=bc]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Jagdkreuzer in Auftrag gegeben.',
    );
    await page.fill('#q_dr', '1');
    await page.click('[data-act=order][data-k=dr]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Vernichter in Auftrag gegeben.',
    );

    await nav(page, 'fleet');
    await page.getByLabel('Anzahl Jagdkreuzer').fill('2');
    await page.getByLabel('Anzahl Vernichter').fill('1');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_cap')).toContainText('3.500');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await expect(page.locator('.fl-transport')).toContainText(
      '2 Jagdkreuzer, 1 Vernichter',
    );
    expect(w.problems).toEqual([]);
  });

  test('the shipyard shows Schlachtkreuzer and Zerstörer on a phone (#58, #59) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Zerst');
    await register(page, name);
    seed({ name, b: { robot: 2, yard: 8, lab: 7 }, research: { hdrive: 5 } });
    await page.goto('/?view=shipyard');
    await expect(page.getByRole('img', { name: 'Jagdkreuzer' })).toBeVisible();
    const dr = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Vernichter/ }),
    });
    await expect(dr.getByRole('img', { name: 'Vernichter' })).toBeVisible();
    await expect(
      dr.locator('.need-nm', { hasText: /^Orbitale Schiffsschmiede$/ }),
    ).toBeVisible();
    await expect(dr.locator('[data-act=order]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

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

  test('the Bomber is built, switches its drive at Hyperraumantrieb 8 and flies (#57)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Belagerungsbomber');
    await register(page, name);
    const base = {
      name,
      b: { robot: 2, yard: 8, lab: 7 },
      ships: { bb: 2 },
      res: { m: 200000, c: 200000, d: 100000 },
    };
    seed({ ...base, research: { impulse: 6, plasma: 5 }, colony: {} });
    await page.goto('/?view=shipyard');
    const bb = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Belagerungsbomber/ }),
    });
    await expect(
      bb.getByRole('img', { name: 'Belagerungsbomber' }),
    ).toHaveAttribute('src', '/icons/ships/bomber.svg');
    await expect(bb).toContainText(
      'Angriff 1.000 · Schild 500 · Struktur 75.000 · Ladung 500 · Tempo 8.800 (Plasma-Impulsantrieb)',
    );
    await expect(bb.locator('.needs')).toHaveCount(0);

    seed({ ...base, research: { impulse: 6, plasma: 5, hdrive: 8 } });
    await page.reload();
    await expect(bb).toContainText('Tempo 17.000 (Warp-Antrieb)');
    await page.fill('#q_bb', '1');
    await page.click('[data-act=order][data-k=bb]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Belagerungsbomber in Auftrag gegeben.',
    );

    await nav(page, 'fleet');
    await expect(
      page
        .locator('tr', { hasText: 'Belagerungsbomber' })
        .locator('td.n')
        .nth(1),
    ).toHaveText('17.000');
    await page.getByLabel('Anzahl Belagerungsbomber').fill('2');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_cap')).toContainText('1.000');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await expect(page.locator('.fl-transport')).toContainText(
      '2 Belagerungsbomber',
    );
    expect(w.problems).toEqual([]);
  });

  test('the shipyard shows the Bomber and its drive on a phone (#57) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Bomb');
    await register(page, name);
    seed({ name, b: { robot: 2, yard: 8, lab: 7 }, research: { impulse: 6 } });
    await page.goto('/?view=shipyard');
    const bb = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Belagerungsbomber/ }),
    });
    await expect(
      bb.getByRole('img', { name: 'Belagerungsbomber' }),
    ).toBeVisible();
    await expect(bb).toContainText('Tempo 8.800 (Plasma-Impulsantrieb)');
    await expect(
      bb.locator('.need-nm', { hasText: /^Plasma-Lehre$/ }),
    ).toBeVisible();
    await expect(bb.locator('[data-act=order]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('the Todesstern is built after the Bomber, faster with the Nanitenfabrik, and flies (#60)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Stern');
    await register(page, name);
    const base = {
      name,
      research: { hyper: 6, hdrive: 7, graviton: 1 },
      ships: { dstar: 1 },
      res: { m: 5000000, c: 4000000, d: 2000000 },
    };
    seed({ ...base, b: { robot: 2, yard: 12, lab: 7 }, colony: {} });
    await page.goto('/?view=shipyard');
    // Read the order only once the list is rendered (it was flaky before).
    await expect(
      page.locator('.item .nm', { hasText: /^\s*Weltenbrecher/ }),
    ).toBeVisible();
    const names = (await page.locator('.item .nm').allTextContents()).map((t) =>
      t.trim(),
    );
    const at = (nm: string) => names.findIndex((t) => t.startsWith(nm));
    expect(at('Weltenbrecher')).toBe(at('Belagerungsbomber') + 1);
    const ts = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Weltenbrecher/ }),
    });
    await expect(
      ts.getByRole('img', { name: 'Weltenbrecher' }),
    ).toHaveAttribute('src', '/icons/ships/deathstar.svg');
    await expect(ts).toContainText(
      'Angriff 200.000 · Schild 50.000 · Struktur 9.000.000 · Ladung 1.000.000 · Tempo 310',
    );
    await expect(ts).toContainText(
      'Gewaltige Kampfstation; zerstört fast alles mit Schnellfeuer.',
    );
    await expect(ts.locator('.needs')).toHaveCount(0);
    const buildTime = async (): Promise<number> =>
      seconds(
        (await ts.locator('.dim', { hasText: 'Bauzeit' }).textContent())!,
      );
    const before = await buildTime();
    seed({ ...base, b: { robot: 2, yard: 12, lab: 7, nanite: 1 } });
    await page.reload();
    expect(Math.abs((await buildTime()) * 2 - before)).toBeLessThanOrEqual(1);
    await page.fill('#q_dstar', '1');
    await page.click('[data-act=order][data-k=dstar]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Weltenbrecher in Auftrag gegeben.',
    );

    await nav(page, 'fleet');
    await expect(
      page.locator('tr', { hasText: 'Weltenbrecher' }).locator('td.n').nth(1),
    ).toHaveText('310');
    await page.getByLabel('Anzahl Weltenbrecher').fill('1');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_cap')).toContainText('1.000.000');
    await expect(page.locator('#i_fuel')).toHaveText('1 Promethium');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await expect(page.locator('.fl-transport')).toContainText(
      '1 Weltenbrecher',
    );
    expect(w.problems).toEqual([]);
  });

  test('the shipyard shows the Todesstern and its requirements on a phone (#60) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('TodS');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 12, lab: 7 },
      research: { hyper: 6, hdrive: 7 },
    });
    await page.goto('/?view=shipyard');
    const ts = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Weltenbrecher/ }),
    });
    await expect(ts.getByRole('img', { name: 'Weltenbrecher' })).toBeVisible();
    await expect(ts).toContainText('Tempo 310');
    await expect(
      ts.locator('.need-nm', { hasText: /^Gravitonen-Mysterium$/ }),
    ).toBeVisible();
    await expect(ts.locator('[data-act=order]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('a Verlegung moves part of a fleet with its cargo to an own colony for good (#129)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Verleg');
    await register(page, name);
    seed({
      name,
      ships: { sc: 3, lf: 2 },
      res: { m: 100000, c: 100000, d: 100000 },
      colony: { p: 14, name: 'Vorposten', res: { m: 0, c: 0, d: 0 } },
    });
    await page.goto('/?view=fleet');
    await page.getByLabel('Anzahl Frachtläufer').fill('2');
    await page.getByLabel('Position', { exact: true }).fill('14');
    await page.getByLabel('Auftrag').selectOption('deploy');
    await expect(
      page.getByLabel('Auftrag').locator('option:checked'),
    ).toHaveText('Verlegung');
    await page.locator('#c_m').fill('3000');
    await expect(page.locator('#i_arr')).toContainText(' / –');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs nach',
    );
    await expect(page.locator('.fl-deploy')).toContainText('2 Frachtläufer');
    await expect(page.locator('.fl-deploy')).toContainText('Verlegung');
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('1');

    seed({ name, landFleet: 'deploy' });
    await expect(page.locator('.fl-deploy')).toHaveCount(0, {
      timeout: 30000,
    });
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('1');
    await choosePlanet(page, 'Vorposten');
    await expect(shipCount(page, 'Frachtläufer')).toHaveText('2');
    await expect(page.locator('#f_lf')).toHaveCount(0);
    await nav(page, 'messages');
    await page.locator('.rep .t', { hasText: 'Verlegung erreicht' }).click();
    await expect(page.locator('.rep.open')).toContainText(
      'Deine Flotte bleibt auf Vorposten',
    );
    expect(w.problems).toEqual([]);
  });

  test('a Verlegung starts from the galaxy and lands on the colony on a phone (#129) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('VerlH');
    // A unique name: the test above seeds its „Vorposten“ into a home system
    // that can be this one, and the row would match both (#252).
    const outpost = uniqueName('Vorposten');
    await register(page, name);
    seed({
      name,
      ships: { lf: 3 },
      res: { m: 100000, c: 100000, d: 100000 },
      colony: { p: 13, name: outpost, res: { m: 0, c: 0, d: 0 } },
    });
    await page.goto('/?view=galaxy');
    await page.getByText('zum Heimatsystem').click();
    const row = page.locator('tr', { hasText: outpost });
    await expect(row.getByRole('button', { name: 'Verlegung' })).toBeVisible();
    // Against the device width: a too wide table also widens innerWidth.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    await row.getByRole('button', { name: 'Verlegung' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('deploy');
    await expect(page.getByLabel('Position', { exact: true })).toHaveValue(
      '13',
    );
    await page.getByLabel('Anzahl Abfangjäger').fill('2');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs nach',
    );
    await expect(page.locator('.fl-deploy')).toContainText('2 Abfangjäger');
    seed({ name, landFleet: 'deploy' });
    await expect(page.locator('.fl-deploy')).toHaveCount(0, {
      timeout: 30000,
    });
    await expect(shipCount(page, 'Abfangjäger')).toHaveText('1');
    await choosePlanet(page, outpost);
    await expect(shipCount(page, 'Abfangjäger')).toHaveText('2');
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

  test('the layout works on a phone @phone', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Handy'));
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('#tabbar')).toBeVisible();
    const overflow = (): Promise<number> =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
    await page.click('#tabbar [data-v=buildings]');
    await expect(page.locator('#tabbar a.on')).toHaveAttribute(
      'data-v',
      'buildings',
    );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.click('#tabbar [data-act=moreOpen]');
    await expect(page.locator('#more')).toBeVisible();
    await page.click('#more-list [data-v=galaxy]');
    await expect(page.locator('#more')).toBeHidden();
    await expect(page.locator('h2')).toContainText('Sternenkarte');
    await expect(page.locator('#tabbar [data-act=moreOpen]')).toHaveClass(/on/);
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('planet animations can be turned off for this device', async ({
    page,
  }) => {
    await register(page, uniqueName('Ruhe'));
    const surface = page.locator('.pl .pl-surface');
    await expect(surface).not.toHaveCSS('animation-name', 'none');
    await nav(page, 'help');
    await page.getByLabel('Animationen').uncheck();
    await nav(page, 'overview');
    await expect(surface).toHaveCSS('animation-name', 'none');
    await page.reload();
    await expect(surface).toHaveCSS('animation-name', 'none');
    await nav(page, 'help');
    await expect(page.getByLabel('Animationen')).not.toBeChecked();
  });
});

test.describe('explanation texts (#63, the „?“ opens the Lexicanum since #285)', () => {
  const question = (page: Page, name: string): Locator =>
    page.getByRole('button', { name: `Erklärung zu ${name}` });
  const row = (page: Page, name: string): Locator =>
    page.locator('.item').filter({
      has: page.locator('.nm', { hasText: new RegExp(`^\\s*${name}\\b`) }),
    });
  const panel = (page: Page): Locator => page.locator('#lexicanum-panel');

  /** Chooses the display option in „Hilfe & Optionen“ and saves it. */
  async function choose(page: Page, label: string): Promise<void> {
    await nav(page, 'help');
    await page.getByLabel('(?)-Symbol').selectOption({ label });
    await page.click('[data-act=saveopt]');
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
  }

  test('the (?) opens the article by click and keyboard; the option changes the lists and survives a reload', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Lies');
    await register(page, name);
    seed({ name, b: { lab: 1, robot: 2, yard: 2 } });
    await page.goto('/?view=buildings');

    // Default „Anzeigen“ (D2): the short text is shown, the long one (#94)
    // is the introduction of the article in the side panel.
    const mine = row(page, 'Adamant-Tiefbohrung');
    const mineQ = question(page, 'Adamant-Tiefbohrung');
    await expect(mine.locator('.ds')).toHaveText(
      'Fördert Adamant, den wichtigsten Grundrohstoff.',
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'false');
    await mineQ.click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('metal')!.lt!),
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'true');
    await expect(mineQ).toHaveAttribute('aria-controls', 'lexicanum-panel');
    await expect(page.locator('#view .ex')).toHaveCount(0);
    // The (?) of another entry shows its article instead.
    await question(page, 'Psikristall-Steinbruch').click();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('crystal')!.lt!),
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    await nav(page, 'research');
    const spyQ = question(page, 'Auspex-Lehre');
    await spyQ.focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('spy')!.lt!),
    );
    await expect(spyQ).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(spyQ).toBeFocused();
    await page.keyboard.press('Space');
    await expect(panel(page)).toBeVisible();
    await spyQ.click();
    await expect(panel(page)).toHaveCount(0);

    // Ships and defense have the (?) and their article as well (#94).
    await nav(page, 'shipyard');
    await question(page, 'Spähschädel').click();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('probe')!.lt!),
    );
    await expect(question(page, 'Sonnenreliquiar')).toHaveCount(1);
    // The panel closes when its list is left.
    await nav(page, 'overview');
    await expect(panel(page)).toHaveCount(0);

    await choose(page, 'Ausblenden');
    await nav(page, 'buildings');
    await expect(page.locator('#view .exq')).toHaveCount(0);
    await expect(mine.locator('.ds')).toBeVisible();
    await page.reload();
    await expect(mine.locator('.ds')).toBeVisible();
    await expect(page.locator('#view .ex, #view .exq')).toHaveCount(0);
    await nav(page, 'research');
    await expect(row(page, 'Auspex-Lehre').locator('.ds')).toBeVisible();
    await expect(page.locator('#view .ex, #view .exq')).toHaveCount(0);
    await nav(page, 'help');
    await expect(page.getByLabel('(?)-Symbol')).toHaveValue('hidden');
    await choose(page, 'Anzeigen');
    await nav(page, 'buildings');
    await expect(mineQ).toBeVisible();
    expect(w.problems).toEqual([]);
  });

  test('a tap on the (?) opens the article as a page on a phone @phone', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Tipp'));
    await page.click('#tabbar [data-v=buildings]');
    await question(page, 'Sonnenkathedrale').tap();
    await expect(page).toHaveURL(/[?&]view=lexicanum&a=solar$/);
    await expect(page.locator('#view .lx-intro p')).toHaveText(
      lines(entryText('solar')!.lt!),
    );
    await expect(panel(page)).toHaveCount(0);
    await page.goBack();
    await expect(question(page, 'Sonnenkathedrale')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});

test.describe('push kinds (#192)', () => {
  const KINDS = [
    'Gebäude fertig',
    'Forschung abgeschlossen',
    'Auftrag der Schiffsschmiede abgeschlossen',
    'Eigene Flotten: Ankunft, Bericht und Rückkehr',
    'Sturmangriff auf deine Planeten',
    'Auspex-Aktivität bei deinen Planeten',
    'Lieferung eines anderen Spielers',
    'Servernachrichten',
    'Neue Version',
    'Gildenereignisse',
    'Nachrichten im Gilden-Chat',
  ];
  const kinds = (page: Page): Locator =>
    page.getByRole('group', { name: 'Welche Meldungen per Push kommen' });
  const kind = (page: Page, name: string): Locator =>
    kinds(page).getByRole('checkbox', { name, exact: true });

  /** Every kind with its checkbox state, in the order of the options. */
  async function states(page: Page): Promise<[string, boolean][]> {
    const out: [string, boolean][] = [];
    for (const name of KINDS)
      out.push([name, await kind(page, name).isChecked()]);
    return out;
  }

  /** Switches one kind with `toggle`, waits for the save and reloads. */
  async function switchKind(
    page: Page,
    name: string,
    toggle: (box: Locator) => Promise<void>,
  ): Promise<void> {
    await toggle(kind(page, name));
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
    await page.reload();
    await nav(page, 'help');
  }

  test('the box is hidden on a server without Web Push (owner, 2026-11-14)', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Stumm'));
    await nav(page, 'help');
    const titles = page.locator('.box .hd');
    await expect(
      titles.getByText('Browser-Benachrichtigungen', { exact: true }),
    ).toBeVisible();
    await expect(
      titles.getByText('Benachrichtigungen', { exact: true }),
    ).toHaveCount(0);
    await expect(kinds(page)).toHaveCount(0);
    await expect(page.locator('[data-chg=push]')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });

  test('every kind is on; one is switched off and on again and survives a reload', async ({
    page,
  }) => {
    const w = watch(page);
    await withWebPush(page);
    await register(page, uniqueName('Glocke'));
    await nav(page, 'help');
    await expect(
      page.locator('.box .hd').getByText('Benachrichtigungen', { exact: true }),
    ).toBeVisible();
    await expect(kinds(page).getByRole('checkbox')).toHaveCount(KINDS.length);
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));

    await switchKind(page, 'Sturmangriff auf deine Planeten', (box) =>
      box.uncheck(),
    );
    expect(await states(page)).toEqual(
      KINDS.map((n) => [n, n !== 'Sturmangriff auf deine Planeten']),
    );

    // By keyboard: Space switches it on again, the focus stays on it.
    const attacked = kind(page, 'Sturmangriff auf deine Planeten');
    await attacked.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
    await expect(attacked).toBeChecked();
    await expect(attacked).toBeFocused();
    await page.reload();
    await nav(page, 'help');
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));
    expect(w.problems).toEqual([]);
  });

  test('two quick changes both stay, even when the first save is slow (CodeRabbit on #204)', async ({
    page,
  }) => {
    const w = watch(page);
    await withWebPush(page);
    // The first save reaches the server late, as on a slow connection; a
    // second save sent meanwhile would arrive first and be overwritten.
    let saves = 0;
    let answered = 0;
    await page.route('**/api/action', async (route) => {
      const body = route.request().postDataJSON() as { type?: string };
      if (body.type === 'pushOptions' && ++saves === 1)
        await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    page.on('response', (r) => {
      if (
        r.url().endsWith('/api/action') &&
        r.request().postDataJSON()?.type === 'pushOptions'
      )
        answered++;
    });
    await register(page, uniqueName('Eilig'));
    await nav(page, 'help');
    await kind(page, 'Neue Version').click();
    await kind(page, 'Servernachrichten').click();
    await expect(kind(page, 'Neue Version')).not.toBeChecked();
    await expect(kind(page, 'Servernachrichten')).not.toBeChecked();
    await expect.poll(() => answered).toBe(2);
    await page.reload();
    await nav(page, 'help');
    expect(await states(page)).toEqual(
      KINDS.map((n) => [n, n !== 'Neue Version' && n !== 'Servernachrichten']),
    );
    expect(w.problems).toEqual([]);
  });

  test('a kind is switched off and on again on a phone @phone', async ({
    page,
  }) => {
    const w = watch(page);
    await withWebPush(page);
    await register(page, uniqueName('Klingel'));
    await nav(page, 'help');
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));
    await switchKind(page, 'Nachrichten im Gilden-Chat', (box) => box.tap());
    expect(await states(page)).toEqual(
      KINDS.map((n) => [n, n !== 'Nachrichten im Gilden-Chat']),
    );
    await switchKind(page, 'Nachrichten im Gilden-Chat', (box) => box.tap());
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});

test.describe('admin', () => {
  test('an admin can inspect a player and audit the data access', async ({
    page,
    browser,
  }) => {
    const name = uniqueName('Audit');
    const pilot = uniqueName('Pilot');
    const other = await browser.newPage();
    await register(other, pilot);
    await nav(other, 'buildings');
    await other.click('[data-act=build][data-k=metal]');
    await expect(other.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await expect(
      page.getByRole('button', { name: 'Erste Seite' }),
    ).toBeDisabled();
    await expect(page.getByLabel('Pro Seite')).toHaveValue('10');
    await page.getByRole('tab', { name: 'Spieler', exact: true }).click();
    await page
      .locator('[data-admin=stats]')
      .getByRole('button', { name: pilot, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: `Spielerakte · ${pilot}` }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Ereignisse zu diesem Spieler' })
      .click();
    await expect(
      page.getByRole('row', { name: /game \/ build/ }),
    ).toContainText(pilot);
    await page.getByLabel('Spieler', { exact: true }).selectOption('');
    await page.getByLabel('Aktion', { exact: true }).fill('player');
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    const audit = page.getByRole('row', { name: /admin.read \/ player/ });
    await expect(audit).toContainText(name);
    await expect(audit).toContainText(pilot);
    await other.close();
  });

  test('only an admin made by the operator sees the admin panel', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Chef');
    await register(page, name);
    await expect(page.locator('#menu [data-v=admin]')).toHaveCount(0);
    expect(cli('admin', name)).toContain(`${name} is now admin.`);
    await page.reload();
    await nav(page, 'admin');
    await expect(page.locator('h2')).toHaveText('Admin');

    await page.getByRole('tab', { name: 'Einladungen' }).click();
    // Invitation without SMTP: the link is shown for copying.
    await page.fill('#inv_email', 'freund@example.org');
    await page.click('#inviteform button[type=submit]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Kein SMTP eingerichtet',
    );
    await expect(page.locator('#inv_link')).toHaveValue(/#invite=[\w-]{43}$/);
    await expect(page.locator('#admin-invitations table.mini')).toContainText(
      'freund@example.org',
    );
    await page
      .locator('tr', { hasText: 'freund@example.org' })
      .locator('[data-act=revoke]')
      .click();
    await expect(
      page.locator('tr', { hasText: 'freund@example.org' }),
    ).toHaveCount(0);

    await page.getByRole('tab', { name: 'Universum' }).click();
    // Settings: live, but the universe never shrinks below a planet. The
    // planet in galaxy 2 comes from this test, not from an earlier one.
    seed({ name, colony: { g: 2, s: 1, p: 15, name: 'Außenposten' } });
    await page.fill('#set_speed', '7');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x7',
    );
    await page.fill('#set_galaxies', '1');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Galaxien: mindestens 2',
    );
    await page.fill('#set_galaxies', '2');
    await page.fill('#set_speed', '5');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x5',
    );
    expect(cli('unadmin', name)).toContain('no longer admin');
    expect(w.problems).toEqual([]);
  });
});
