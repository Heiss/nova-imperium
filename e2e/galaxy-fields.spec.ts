// The fields „Galaxie“ and „System“ of the Sternenkarte stay the same
// elements over a render that is not fresh (#352): a player who selected the
// number and types over it gets exactly what was typed, even when the news,
// the poll or the clock draws the page in between. Playwright's fill() does
// the same two steps (select, then insert), so the test does them by hand
// with a render between them. The renders are told by what they draw outside
// the Sternenkarte: the mark of „Neuigkeiten“ in the menu (the render of the
// news, news.ts) and the choice of the planet in the header (the poll after a
// new colony). A fresh render still drops the typed position (#332), as
// e2e/redraw-drafts.spec.ts and e2e/galaxy.spec.ts check.
import { expect, test, type Page } from '@playwright/test';
import { register, seed, uniqueName, watch } from './helpers.ts';

/** The first step of fill(): the focus in the field and its text selected. */
async function selectByHand(page: Page, id: string): Promise<void> {
  await page.evaluate((field) => {
    const input = document.getElementById(field) as HTMLInputElement;
    input.focus();
    input.select();
  }, id);
}

/** Opens the Sternenkarte with the answer of the news held until `release` is called. */
async function openWithNewsHeld(page: Page): Promise<() => void> {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/news', async (route) => {
    await held;
    await route.continue();
  });
  await page.goto('/?view=galaxy');
  await expect(page.locator('#g_s')).toHaveValue(/^\d+$/);
  await expect(page.locator('#menu [data-v=news] .badge')).toHaveCount(0);
  return release;
}

// Each case runs on the desktop and, tagged, on the phone (playwright.config.ts).
for (const tag of ['', ' @phone']) {
  test.describe(`the fields of the Sternenkarte over a render (#352)${tag}`, () => {
    for (const [id, label] of [
      ['g_s', 'System'],
      ['g_g', 'Galaxie'],
    ] as const) {
      test(`„${label}“ selected, the news drawn, then typed: exactly what was typed`, async ({
        page,
      }) => {
        const w = watch(page);
        await register(page, uniqueName('FeldKarte'));
        const release = await openWithNewsHeld(page);
        await selectByHand(page, id);
        release();
        // The render of the news has run: it drew the mark of „Neuigkeiten“.
        await expect(page.locator('#menu [data-v=news] .badge')).toHaveCount(1);
        await page.keyboard.insertText('1');
        await expect(page.locator(`#${id}`)).toHaveValue('1');
        await expect(page.locator(`#${id}`)).toBeFocused();
        expect(w.problems).toEqual([]);
      });
    }

    test('the focus stays in a field over a render that is not fresh', async ({
      page,
    }) => {
      const w = watch(page);
      await register(page, uniqueName('FeldKarte'));
      const release = await openWithNewsHeld(page);
      await page.locator('#g_g').focus();
      release();
      await expect(page.locator('#menu [data-v=news] .badge')).toHaveCount(1);
      await expect(page.locator('#g_g')).toBeFocused();
      expect(w.problems).toEqual([]);
    });

    test('„System“ selected, the poll drawn, then typed: exactly what was typed', async ({
      page,
    }) => {
      const w = watch(page);
      const name = uniqueName('FeldKarte');
      await register(page, name);
      await page.goto('/?view=galaxy');
      await expect(page.locator('#menu [data-v=news] .badge')).toHaveCount(1);
      await selectByHand(page, 'g_s');
      seed({ name, colony: {} });
      // The poll has drawn the new state: the header offers the colony.
      await expect(page.locator('#planet_select')).toHaveCount(1, {
        timeout: 15000,
      });
      await page.keyboard.insertText('1');
      await expect(page.locator('#g_s')).toHaveValue('1');
      expect(w.problems).toEqual([]);
    });
  });
}
