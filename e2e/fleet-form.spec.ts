// The fleet form keeps what the player chose over a redraw (#253, #118, #53).
// The poll of the client (every 4 s) draws the view (`pollRender` of
// helpers.ts tells when, #361); a form built anew is built for the start planet, where the list „Auftrag“ holds the missions of
// the start target and „Mond“ is disabled, and two bugs lost the choice: a
// Vermessung chosen for a free position came back as the first mission, and a
// fleet aimed at a moon went to the planet. The unit tests of
// src/client/features/fleet-lists.test.ts cover the logic with a fake page;
// this spec runs the real poll in the browser.
import { expect, test } from '@playwright/test';
import {
  lastToast,
  pollRender,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('the fleet form over a redraw (#253)', () => {
  test('a Vermessung chosen for a free position is still chosen after the poll, and the fleet is sent as a survey', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('FormVermessen');
    await register(page, name);
    seed({
      name,
      ships: { probe: 2 },
      research: { carto: 5 },
      res: { m: 0, c: 0, d: 10000 },
    });
    await page.goto('/?view=fleet');
    // Slot 2 of the home system of this test is free (homes lie on 4 to 12).
    await page.getByLabel('Position', { exact: true }).fill('2');
    await page.getByLabel('Anzahl Spähschädel').fill('1');
    await expect(page.locator('#t_info')).toHaveText('Freie Position');
    const mission = page.getByLabel('Auftrag');
    // Vermessung is not the first mission the free position offers.
    await expect(mission).not.toHaveValue('survey');
    await mission.selectOption('survey');
    await expect(mission).toHaveValue('survey');

    await pollRender(page, name);
    await expect(mission).toHaveValue('survey');
    await expect(page.getByLabel('Position', { exact: true })).toHaveValue('2');
    await expect(page.getByLabel('Anzahl Spähschädel')).toHaveValue('1');

    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await expect(page.locator('.fl-survey')).toContainText('Vermessung');
    expect(w.problems).toEqual([]);
  });

  test('„Mond“ chosen for a place with a moon is still chosen after the poll, and the fleet flies to the moon', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('FormMond');
    await register(page, name);
    seed({ name, moon: {}, ships: { sc: 2 }, res: { m: 0, c: 0, d: 10000 } });
    await page.goto('/?view=fleet');
    const kind = page.getByLabel('Zielart');
    const mission = page.getByLabel('Auftrag');
    // The own planet is the first target; its moon is enabled in „Zielart“.
    await page.getByLabel('Anzahl Frachtläufer').fill('1');
    await expect(kind.locator('option[value=moon]')).toBeEnabled();
    await kind.selectOption('moon');
    await expect(page.locator('#t_info')).toHaveText(`Mond (Mond) (${name})`);
    await expect(mission).not.toHaveValue('deploy');
    await mission.selectOption('deploy');

    await pollRender(page, name);
    await expect(kind).toHaveValue('moon');
    await expect(kind.locator('option[value=moon]')).toBeEnabled();
    await expect(page.locator('#t_info')).toHaveText(`Mond (Mond) (${name})`);
    await expect(mission).toHaveValue('deploy');

    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await expect(page.locator('.fl-deploy')).toContainText('Verlegung');
    // The form forgets the choice once the fleet is sent.
    await expect(kind).toHaveValue('planet');
    expect(w.problems).toEqual([]);
  });
});
