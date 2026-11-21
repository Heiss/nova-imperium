// The Nanitenfabrik (#48): it halves build times and stops the shipyard.
import { expect, test } from '@playwright/test';
import { register, seed, uniqueName, watch } from './helpers.ts';

test.describe('playing', () => {
  test('the Nanitenfabrik halves build times and stops the shipyard (#48)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Nanit');
    await register(page, name);
    const b = { robot: 10, yard: 2, lab: 1 };
    seed({
      name,
      b,
      research: { computer: 10 },
      res: { m: 5e6, c: 5e6, d: 5e6 },
    });
    const seconds = (text: string): number =>
      [...text.matchAll(/(\d+)([Thms])/g)].reduce(
        (sum, [, n, unit]) =>
          sum + Number(n) * { T: 86400, h: 3600, m: 60, s: 1 }[unit!]!,
        0,
      );
    const item = (nm: RegExp) =>
      page
        .locator('.item')
        .filter({ has: page.locator('.nm', { hasText: nm }) });
    const time = async (nm: RegExp, label: string): Promise<number> =>
      seconds(
        (await item(nm)
          .locator('.dim', { hasText: label })
          .first()
          .textContent())!,
      );
    const times = async () => {
      await page.goto('/?view=buildings');
      const building = await time(/^\s*Adamant-Tiefbohrung/, 'Bauzeit');
      await page.goto('/?view=shipyard');
      const ship = await time(/^\s*Abfangjäger/, 'Bauzeit');
      await page.goto('/?view=research');
      const research = await time(/^\s*Machina-Energetik/, 'Forschungszeit');
      return { building, ship, research };
    };
    const before = await times();
    seed({ name, b: { ...b, nanite: 1 } });
    const after = await times();
    expect(Math.abs(after.building * 2 - before.building)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(after.ship * 2 - before.ship)).toBeLessThanOrEqual(1);
    expect(after.research).toBe(before.research);

    await page.goto('/?view=buildings');
    await expect(
      item(/^\s*Machina-Schwarmhalle/).getByRole('img', {
        name: 'Machina-Schwarmhalle',
      }),
    ).toHaveAttribute('src', '/icons/buildings/nanite_factory.svg');
    await page.click('[data-act=build][data-k=nanite]');
    await expect(page.locator('.item.running')).toContainText(
      'Machina-Schwarmhalle',
    );
    await page.goto('/?view=shipyard');
    await expect(page.locator('.notice.warn')).toHaveText(
      'Die Machina-Schwarmhalle wird gerade ausgebaut, die Schiffsschmiede kann nicht produzieren.',
    );
    // The Raketenwerfer needs only the shipyard, so it shows an order button.
    await page.goto('/?view=defense');
    await expect(page.locator('.notice.warn')).toContainText(
      'Machina-Schwarmhalle',
    );
    await expect(page.locator('[data-act=order][data-k=rl]')).toBeDisabled();
    expect(w.problems).toEqual([]);
  });
});
