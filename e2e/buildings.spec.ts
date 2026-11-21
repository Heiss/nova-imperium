// Buildings: the build queue, the buttons of an expired build, production
// shares, renaming, and the first colony.
import { expect, test } from '@playwright/test';
import {
  expectShownPlace,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';
import { fieldRange, fieldsOf } from '../src/core/fields.ts';

test.describe('playing', () => {
  test('an expired build restores the buttons and leaves a view notice', async ({
    page,
  }) => {
    await page.clock.install();
    await register(page, uniqueName('Fertig'));
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=metal]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();

    // Keep state refreshes pending to verify the UI updates before a reply.
    await page.route('**/api/state', () => {});
    const deadline = Number(
      await page.locator('#view .cd').getAttribute('data-end'),
    );
    await page.clock.fastForward(
      deadline - (await page.evaluate(() => Date.now())) + 3000,
    );
    await expect(page.locator('[data-act=build][data-k=metal]')).toBeEnabled();
    await expect(page.locator('[data-act=cancelBuild]')).toHaveCount(0);
    const notice = page
      .getByRole('status')
      .filter({ hasText: 'Ausbau fertig' });
    const badge = page.locator('#menu [data-v=buildings] .badge');
    await expect(badge).toHaveAttribute('aria-label', 'Ausbau fertig');
    await expect(notice).toBeVisible();
    await nav(page, 'overview');
    await nav(page, 'buildings');
    await expect(page.locator('#menu [data-v=buildings] .badge')).toHaveCount(
      0,
    );
    await expect(notice).toHaveCount(0);
  });

  test('resource production enables an unaffordable build in place', async ({
    page,
  }) => {
    await page.clock.install();
    const name = uniqueName('Rohstoff');
    await register(page, name);
    seed({ name, res: { m: 59, c: 500, d: 0 } });
    await page.goto('/?view=buildings');
    const build = page.locator('[data-act=build][data-k=metal]');
    await expect(build).toBeDisabled();
    await build.evaluate((button) =>
      button.setAttribute('data-same-button', ''),
    );
    await page.route('**/api/state', () => {});
    await page.clock.fastForward(5 * 60 * 1000);
    await expect(build).toBeEnabled();
    await expect(build).toHaveAttribute('data-same-button', '');
    await expect(page).toHaveURL(/\?view=buildings$/);
  });

  test('retries a build once when SQLite is busy', async ({ page }) => {
    await register(page, uniqueName('Retry'));
    await nav(page, 'buildings');
    let attempts = 0;
    await page.route('**/api/action', async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.fulfill({ status: 503, json: { code: 'ACTION_DB_BUSY' } });
      } else {
        await route.continue();
      }
    });
    await page.click('[data-act=build][data-k=metal]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await expect(page.locator('#resbar')).toContainText('440');
    expect(attempts).toBe(2);
  });

  test('build, cancel, set production and rename', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Bau'));
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=metal]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await expect(page.locator('.item.running')).toHaveCount(1);
    await expect(page.getByLabel('Fortschritt Ausbau')).toBeVisible();
    await expect(page.locator('#resbar')).toContainText('440');
    await page.click('[data-act=cancelBuild]');
    await expect(page.locator('.item.running')).toHaveCount(0);
    await expect(page.locator('[data-act=build][data-k=metal]')).toBeEnabled();
    await expect(page.locator('#resbar')).toContainText('500');
    await nav(page, 'resources');
    await page.selectOption('select[data-k=metal]', '50');
    await expect(page.locator('select[data-k=metal]')).toHaveValue('50');
    await nav(page, 'overview');
    await page.click('[data-act=rename]');
    await page.fill('#rn', 'Neu<b>Welt');
    await page.click('[data-act=doRename]');
    await expect(page.locator('h2')).toContainText('Neu<b>Welt');
    expect(w.problems).toEqual([]);
  });

  test('builds solar and switches to a newly founded colony', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Kolonie');
    await register(page, name);
    seed({
      name,
      b: { robot: 10, yard: 4 },
      ships: { colony: 1 },
      research: { impulse: 3 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    await page.reload();
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=solar]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await nav(page, 'galaxy');
    await page.getByText('zum Heimatsystem').click();
    await page.getByRole('button', { name: 'Landnahme' }).first().click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('colonize');
    await page.getByLabel('Anzahl Kolonistenarche').fill('1');
    await page.locator('#c_m').fill('400');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    seed({ name, landColonyFleet: true });
    const selector = page.getByLabel('Aktiver Planet');
    const colony = selector
      .locator('option')
      .filter({ hasText: /^Kolonie \[/ });
    await expect(colony).toHaveCount(1);
    await selector.selectOption((await colony.getAttribute('value'))!);
    await expectShownPlace(page, 'Kolonie');
    await nav(page, 'overview');
    await expect(page.locator('h2')).toContainText('Kolonie');
    // A colony has fields at random in the range of its position (#51).
    const at = Number(
      /:(\d+)\]/.exec((await page.locator('h2').textContent())!)![1],
    );
    const shown = await page
      .locator('.kv tr', { hasText: 'Durchmesser' })
      .locator('td')
      .nth(1)
      .textContent();
    const [, km, max] = /^([\d.]+) km \(0\/(\d+) Felder\)$/.exec(shown!)!;
    const { min: low, max: high } = fieldRange(at);
    expect(Number(max)).toBeGreaterThanOrEqual(low);
    expect(Number(max)).toBeLessThanOrEqual(high);
    expect(fieldsOf(Number(km!.replaceAll('.', '')))).toBe(Number(max));
    await page.click('[data-act=rename]');
    await page.fill('#rn', 'Neue Welt');
    await page.click('[data-act=doRename]');
    await expect(page.locator('h2')).toContainText('Neue Welt');
    expect(w.problems).toEqual([]);
  });
});
