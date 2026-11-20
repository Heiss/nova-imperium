// What the player typed or chose in a form is still there after the poll of
// the state drew the view anew (#118, package 8: the drafts of
// src/client/logic/field-drafts.ts replace the restore of the redraw). The
// client draws the view anew only when the state it polls (every 4 s)
// differs from the last one, so each test changes the state of its own
// player and waits until the node of a field it marked is replaced.
import { expect, test, type Page } from '@playwright/test';
import { guildTag, nav, register, seed, uniqueName, watch } from './helpers.ts';

async function waitForRedraw(
  page: Page,
  id: string,
  change: () => void,
): Promise<void> {
  await page.evaluate((i) => {
    document.getElementById(i)!.dataset.mark = 'old';
  }, id);
  change();
  await expect(page.locator(`#${id}[data-mark]`)).toHaveCount(0, {
    timeout: 15000,
  });
}

test.describe('a redraw by the poll keeps the draft of a form', () => {
  test('the fleet form keeps the position, the count and the chosen mission', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfFlotte');
    await register(page, name);
    seed({
      name,
      ships: { probe: 3 },
      research: { carto: 5 },
      res: { m: 0, c: 0, d: 10000 },
    });
    await page.goto('/?view=fleet');
    await page.getByLabel('Position', { exact: true }).fill('2');
    await page.getByLabel('Anzahl Spähschädel').fill('2');
    const mission = page.getByLabel('Auftrag');
    await mission.selectOption('survey');

    await waitForRedraw(page, 't_m', () =>
      seed({ name, res: { m: 0, c: 0, d: 10001 } }),
    );
    await expect(page.getByLabel('Position', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('Anzahl Spähschädel')).toHaveValue('2');
    await expect(mission).toHaveValue('survey');
    expect(w.problems).toEqual([]);
  });

  test('the marketplace keeps the amount and the chosen resources', async ({
    page,
  }) => {
    const w = watch(page);
    const player = uniqueName('EntwurfMarkt');
    await register(page, player);
    seed({
      name: player,
      b: { market: 1, robot: 4 },
      res: { m: 5000, c: 100, d: 0 },
      marketReset: true,
    });
    await page.reload();
    await nav(page, 'market');
    const give = page.locator('#market-give');
    await give.selectOption({ index: 1 });
    const chosen = await give.inputValue();
    await page.locator('#market-amount').fill('123');

    await waitForRedraw(page, 'market-amount', () =>
      seed({ name: player, res: { m: 5001, c: 100, d: 0 } }),
    );
    await expect(page.locator('#market-amount')).toHaveValue('123');
    await expect(page.locator('#market-give')).toHaveValue(chosen);
    expect(w.problems).toEqual([]);
  });

  test('the form of a new guild keeps what was typed', async ({ page }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfGilde');
    await register(page, name);
    await nav(page, 'guilds');
    const tag = guildTag('E');
    await page.locator('#guild_tag').fill(tag);
    await page.locator('#guild_name').fill('Halbfertige Gilde');
    await page.locator('#guild_description').fill('Noch nicht fertig');

    await waitForRedraw(page, 'guild_tag', () =>
      seed({ name, res: { m: 0, c: 0, d: 10002 } }),
    );
    await expect(page.locator('#guild_tag')).toHaveValue(tag);
    await expect(page.locator('#guild_name')).toHaveValue('Halbfertige Gilde');
    await expect(page.locator('#guild_description')).toHaveValue(
      'Noch nicht fertig',
    );
    expect(w.problems).toEqual([]);
  });
  test('the position of the Sternenkarte keeps what was typed until Enter', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfKarte');
    await register(page, name);
    await page.goto('/?view=galaxy');
    const gal = page.getByLabel('Galaxie', { exact: true });
    const sys = page.getByLabel('System', { exact: true });
    await expect(gal).toHaveValue(/^\d+$/);
    await gal.fill('1');
    await sys.fill('1');

    await waitForRedraw(page, 'g_g', () =>
      seed({ name, res: { m: 0, c: 0, d: 10003 } }),
    );
    await expect(gal).toHaveValue('1');
    await expect(sys).toHaveValue('1');
    await sys.press('Enter');
    await expect(sys).toHaveValue('1');
    expect(w.problems).toEqual([]);
  });
});
