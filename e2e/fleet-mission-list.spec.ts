// The list „Auftrag“ of the fleet form offers the missions that fit the
// target (#253, owner 2026-11-16 and 2026-11-17): they are hidden, not
// disabled, by the kind of the target: a foreign planet, an empty field, an own
// planet and the start planet itself, and a chosen mission that no longer fits
// gives way to the first one that does when the coordinates change. The pure
// check is unit tested (src/core/mission-fit.test.ts); this runs the form.
import { expect, test, type Page } from '@playwright/test';
import { register, seed, uniqueName, watch } from './helpers.ts';

/** The missions the list offers, by their values. */
const offered = (page: Page): Promise<string[]> =>
  page
    .getByLabel('Auftrag')
    .locator('option')
    .evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));

/** Enters a position of the home system of the test as the target. */
async function aim(page: Page, g: string, s: string, p: string): Promise<void> {
  await page.locator('#t_g').fill(g);
  await page.locator('#t_s').fill(s);
  await page.locator('#t_p').fill(p);
}

test('the list „Auftrag“ follows the kind of the target: foreign planet, empty field, own planet, start planet (#253)', async ({
  page,
  browser,
}) => {
  test.slow();
  const w = watch(page);
  const mine = uniqueName('Auftraege');
  const theirs = uniqueName('Fremder');
  // The foreign player first, to read where the home planet is.
  const other = await browser.newPage();
  const wo = watch(other);
  await register(other, theirs);
  const place = (await other.locator('#pinfo').textContent())!;
  const [, g, s, p] = /\[(\d+):(\d+):(\d+)\]/.exec(place)!;
  await other.close();

  await register(page, mine);
  seed({
    name: mine,
    colony: { name: 'Aussenposten' },
    ships: { sc: 2, probe: 1 },
    res: { m: 0, c: 0, d: 10000 },
  });
  await page.goto('/?view=fleet');
  const mission = page.getByLabel('Auftrag');
  const send = page.getByRole('button', { name: 'Flotte losschicken' });
  await page.getByLabel('Anzahl Frachtläufer').fill('1');

  // The start planet itself: no mission, the list says so, sending is blocked.
  await expect(mission.locator('option')).toHaveText(
    'Kein Auftrag passt zum Ziel',
  );
  await expect(mission).toHaveValue('');
  await expect(send).toBeDisabled();

  // A foreign planet: the missions against it, none of the others.
  await aim(page, g!, s!, p!);
  await expect(page.locator('#t_info')).toContainText(theirs);
  const foreign = await offered(page);
  expect(foreign).toEqual(
    expect.arrayContaining(['attack', 'spy', 'transport']),
  );
  for (const no of ['deploy', 'colonize', 'survey', 'harvest', 'moonbreak'])
    expect(foreign, `foreign planet: ${no}`).not.toContain(no);
  await mission.selectOption('spy');
  await expect(send).toBeEnabled();

  // An empty field: colony and survey; the missions against a planet go.
  // Slot 2 of the home system of this test is free (homes lie on 4 to 12).
  await aim(page, g!, s!, '2');
  await expect(page.locator('#t_info')).toHaveText('Freie Position');
  const free = await offered(page);
  expect(free).toEqual(expect.arrayContaining(['colonize', 'survey']));
  for (const no of ['attack', 'spy', 'deploy', 'hold', 'moonbreak'])
    expect(free, `free field: ${no}`).not.toContain(no);
  // The chosen Auftrag did not fit: the list switched to the first that does.
  await expect(mission).toHaveValue(free[0]!);
  await expect(mission).not.toHaveValue('spy');

  // An own planet (the colony on slot 15): deploy and transport.
  await aim(page, g!, s!, '15');
  await expect(page.locator('#t_info')).toContainText('Aussenposten');
  const own = await offered(page);
  expect(own).toEqual(expect.arrayContaining(['deploy', 'transport']));
  for (const no of ['attack', 'spy', 'colonize', 'survey', 'moonbreak'])
    expect(own, `own planet: ${no}`).not.toContain(no);
  await mission.selectOption('deploy');

  // The coordinates change while a mission is chosen and it still fits: kept.
  await aim(page, g!, s!, '15');
  await expect(mission).toHaveValue('deploy');
  // Back to the foreign planet: Verlegung no longer fits, the first one does.
  await aim(page, g!, s!, p!);
  await expect(mission).not.toHaveValue('deploy');
  await expect(mission).toHaveValue((await offered(page))[0]!);
  expect(await offered(page)).toEqual(foreign);
  expect(w.problems).toEqual([]);
  expect(wo.problems).toEqual([]);
});
