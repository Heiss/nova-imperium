// Research and requirements (#49, #64): missing requirements, the lab on a
// colony, the research network and the requirements two levels away.
import { expect, test } from '@playwright/test';
import {
  choosePlanet,
  expectShownPlace,
  nav,
  register,
  seconds,
  seed,
  stock,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('playing', () => {
  test('lists all missing requirements and starts the next one (#64)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Plan');
    await register(page, name);
    seed({ name, res: { m: 5000, c: 5000, d: 5000 } });
    await page.goto('/?view=buildings');
    // By the name only: the long texts (#94) of other entries name it too.
    const yard = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Orbitale Schiffsschmiede/ }),
    });
    const robot = yard.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Servitorenschmiede$/ }),
    });
    await expect(robot).toContainText('Stufe 2 (aktuell 0)');
    await expect(robot).toHaveClass(/ready/);
    await robot.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(page.locator('.item.running')).toContainText(
      'Servitorenschmiede',
    );
    await expect(page).toHaveURL(/\?view=buildings$/);
    await expect(robot).toContainText('Bauschleife belegt');
    await expect(
      robot.getByRole('button', { name: 'Jetzt bauen' }),
    ).toBeDisabled();
    expect(w.problems).toEqual([]);
  });

  test('starts a research requirement of a ship, indirect ones included (#64)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Jaeger');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 1, lab: 1 },
      res: { m: 50000, c: 50000, d: 50000 },
    });
    await page.goto('/?view=shipyard');
    // By the name only: the long texts (#94) of other entries name it too.
    const fighter = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Abfangjäger/ }),
    });
    const comb = fighter.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Promethium-Brennkammer$/ }),
    });
    const energy = fighter.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Machina-Energetik$/ }),
    });
    await expect(comb).toHaveClass(/missing/);
    await expect(comb).toContainText('braucht Machina-Energetik (Stufe 1)');
    await expect(energy).toContainText('für Promethium-Brennkammer');
    await energy.getByRole('button', { name: 'Jetzt forschen' }).click();
    await expect(energy).toContainText('Es wird bereits geforscht');
    await expect(
      energy.getByRole('button', { name: 'Jetzt forschen' }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\?view=shipyard$/);
    expect(w.problems).toEqual([]);
  });

  test('research view: start a missing research, lab upgrade blocks it (#64)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Labor');
    await register(page, name);
    seed({
      name,
      b: { lab: 1 },
      research: { energy: 1 },
      res: { m: 50000, c: 50000, d: 50000 },
    });
    await page.goto('/?view=buildings');
    await page.click('[data-act=build][data-k=lab]');
    await nav(page, 'research');
    const laser = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Lichtlanzen-Lehre/ }),
    });
    const energy = laser.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Machina-Energetik$/ }),
    });
    await expect(energy).toContainText('Stufe 2 (aktuell 1)');
    await expect(energy).toContainText('Scholarium wird ausgebaut');
    await expect(
      energy.getByRole('button', { name: 'Jetzt forschen' }),
    ).toBeDisabled();
    await nav(page, 'buildings');
    await page.click('[data-act=cancelBuild]');
    await nav(page, 'research');
    await energy.getByRole('button', { name: 'Jetzt forschen' }).click();
    await expect(energy).toContainText('Es wird bereits geforscht');
    await expect(page).toHaveURL(/\?view=research$/);
    expect(w.problems).toEqual([]);
  });

  test('from a colony the lab is built on the colony itself (#49)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Siedler');
    await register(page, name);
    seed({
      name,
      res: { m: 50000, c: 50000, d: 50000 },
      colony: {
        b: { robot: 2, yard: 1 },
        res: { m: 50000, c: 50000, d: 50000 },
      },
    });
    await page.reload();
    await choosePlanet(page, 'Kolonie');
    await nav(page, 'shipyard');
    const fighter = page
      .locator('.item')
      .filter({ has: page.locator('.nm', { hasText: /^\s*Abfangjäger/ }) });
    const lab = fighter.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Scholarium$/ }),
    });
    await expect(lab).toHaveClass(/ready/);
    await expect(lab).not.toContainText('Heimatplanet');
    await lab.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(lab).toContainText('Bauschleife belegt');
    await expectShownPlace(page, 'Kolonie');
    await expect(page).toHaveURL(/\?view=shipyard$/);
    await nav(page, 'buildings');
    await expect(page.locator('.item.running')).toContainText('Scholarium');
    await choosePlanet(page, 'Heimatplanet');
    await expectShownPlace(page, 'Heimatplanet');
    await expect(page.locator('.item.running')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });

  test('research starts on a colony with its own lab and is paid there (#49)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Forscher');
    await register(page, name);
    seed({
      name,
      res: { m: 50000, c: 50000, d: 50000 },
      colony: { b: { lab: 1 }, res: { m: 9000, c: 9000, d: 9000 } },
    });
    await page.goto('/?view=research');
    // The home planet has no lab: the research view offers the colony.
    await expect(page.locator('.notice')).toContainText(
      'Auf diesem Planeten gibt es kein Scholarium.',
    );
    await page.getByRole('button', { name: 'Zu Kolonie' }).click();
    await expectShownPlace(page, 'Kolonie');
    await expect(page.locator('h2')).toHaveText('Forschung auf Kolonie');
    const energy = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Machina-Energetik/ }),
    });
    await energy.locator('[data-act=research]').click();
    await expect(energy.locator('.act')).toContainText('auf Kolonie');
    // Energietechnik costs 800 crystal and 400 deuterium, paid on the colony.
    await expect(stock(page, 'Psikristall')).toHaveText(/^8\.2\d\d$/);
    await expect(stock(page, 'Promethium')).toHaveText(/^8\.6\d\d$/);
    await choosePlanet(page, 'Heimatplanet');
    await expect(stock(page, 'Psikristall')).toHaveText(/^50\.\d{3}$/);
    await nav(page, 'overview');
    await expect(page.getByText('Machina-Energetik (Stufe 1)')).toBeVisible();
    await choosePlanet(page, 'Kolonie');
    await nav(page, 'research');
    await energy.locator('[data-act=cancelResearch]').click();
    await expect(stock(page, 'Psikristall')).toHaveText(/^9\.0\d\d$/);
    expect(w.problems).toEqual([]);
  });

  test('the research network (IFN) links a colony lab and shortens research (#49)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Netz');
    await register(page, name);
    const research = { energy: 3, hyper: 3 };
    seed({
      name,
      b: { lab: 10 },
      research,
      res: { m: 1e6, c: 1e6, d: 1e6 },
      colony: { b: { lab: 6 } },
    });
    const item = (nm: RegExp) =>
      page
        .locator('.item')
        .filter({ has: page.locator('.nm', { hasText: nm }) });
    const time = async (nm: RegExp): Promise<number> =>
      seconds(
        (await item(nm)
          .locator('.dim', { hasText: 'Forschungszeit' })
          .textContent())!,
      );
    await page.goto('/?view=research');
    await expect(
      item(/^\s*Sternennetz der Gelehrten/).getByRole('img', {
        name: 'Sternennetz der Gelehrten',
      }),
    ).toHaveAttribute(
      'src',
      '/icons/research/intergalactic_research_network.svg',
    );
    const shield = await time(/^\s*Refraktionsfelder/);
    const hdrive = await time(/^\s*Warp-Antrieb/);
    seed({ name, research: { ...research, ifn: 1 } });
    await page.reload();
    await expect(page.locator('h2 + .dim')).toContainText(
      'Sternennetz der Gelehrten: bis zu 1 weiteres Scholarium',
    );
    // Labs 10 and 6 research Schildtechnik like lab 16: 11/17 of the time.
    await expect(
      item(/^\s*Refraktionsfelder/).locator('.dim', {
        hasText: 'Forschungszeit',
      }),
    ).toContainText('Scholarien zusammen Stufe 16');
    expect(
      Math.abs((await time(/^\s*Refraktionsfelder/)) - (shield * 11) / 17),
    ).toBeLessThanOrEqual(1);
    // Hyperraumantrieb needs lab 7: the colony lab 6 does not join.
    await expect(
      item(/^\s*Warp-Antrieb/).locator('.dim', {
        hasText: 'Forschungszeit',
      }),
    ).not.toContainText('Scholarien zusammen');
    expect(await time(/^\s*Warp-Antrieb/)).toBe(hdrive);
    const before = Date.now();
    await item(/^\s*Refraktionsfelder/)
      .locator('[data-act=research]')
      .click();
    const left = seconds(
      (await item(/^\s*Refraktionsfelder/)
        .locator('.cd')
        .textContent())!,
    );
    expect(Math.abs(left - (shield * 11) / 17)).toBeLessThanOrEqual(
      2 + (Date.now() - before) / 1000,
    );
    expect(w.problems).toEqual([]);
  });

  test('Gravitonforschung needs 300,000 energy production (#49)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Graviton');
    await register(page, name);
    // Solarkraftwerk 58 produces about 291,900 energy, 59 about 326,600.
    seed({ name, b: { lab: 12, solar: 58 } });
    await page.goto('/?view=research');
    const graviton = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Gravitonen-Mysterium/ }),
    });
    await expect(
      graviton.getByRole('img', { name: 'Energieproduktion' }),
    ).toBeVisible();
    await expect(graviton.locator('.cost b')).toHaveText('300.000');
    await expect(graviton.locator('.cost b')).toHaveClass('bad');
    await expect(graviton.locator('.act')).toContainText(
      /Zu wenig Energie: es fehlen [\d.]+/,
    );
    await expect(graviton.locator('[data-act=research]')).toHaveCount(0);
    const refused = await page.evaluate(async () => {
      const r = await fetch('/api/action', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'research', key: 'graviton' }),
      });
      return ((await r.json()) as { error?: string }).error;
    });
    expect(refused).toMatch(
      /^Zu wenig Energie: Gravitonen-Mysterium braucht eine Energieproduktion von 300\.000, es fehlen [\d.]+\.$/,
    );
    seed({ name, b: { lab: 12, solar: 59 } });
    await page.reload();
    await expect(graviton.locator('.cost b')).not.toHaveClass('bad');
    await expect(
      graviton.locator('.dim', { hasText: 'Forschungszeit' }),
    ).toHaveText('Forschungszeit: 01s');
    await graviton.locator('[data-act=research]').click();
    await expect(graviton.locator('.lv')).toHaveText('(Stufe 1)', {
      timeout: 15000,
    });
    expect(w.problems).toEqual([]);
  });

  test('a requirement two levels away is built level by level (#64, D3)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Stufen');
    await register(page, name);
    seed({ name, res: { m: 50000, c: 50000, d: 50000 } });
    await page.goto('/?view=buildings');
    const yard = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Orbitale Schiffsschmiede/ }),
    });
    const robot = yard.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Servitorenschmiede$/ }),
    });
    await robot.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(page.locator('.item.running')).toContainText(
      'Ausbau auf Stufe 1',
    );
    seed({ name, b: { robot: 1 }, clearQueue: true });
    await page.reload();
    await expect(robot).toContainText('Stufe 2 (aktuell 1)');
    await robot.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(page.locator('.item.running')).toContainText(
      'Ausbau auf Stufe 2',
    );
    seed({ name, b: { robot: 2 }, clearQueue: true });
    await page.reload();
    await expect(yard.locator('.needs')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });
});
