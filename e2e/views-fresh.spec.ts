// The views with fields a player types into keep them over a render that is
// not fresh (#361, following #352 and #355): a player who selected the text of
// a field and types over it gets exactly what was typed, even when the poll
// draws the page in between. Playwright's fill() does the same two steps
// (select, then insert), so the test does them by hand with a render between
// them. The render is told by what it draws outside the view: the choice of
// the planet in the header, which a new colony brings with the poll
// (`pollRender` of helpers.ts). The
// dialogs of the admin and the guilds stand in the modal, which a render does
// not touch; they are checked too.
import { expect, test, type Page } from '@playwright/test';
import {
  cli,
  guildTag,
  nav,
  pollRender,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

/**
 * Types `before` into the field, selects it as fill() does, lets `render`
 * draw the page, then types `after` over the selection: the field holds
 * exactly `after` and keeps the focus.
 */
async function typedOver(
  page: Page,
  selector: string,
  before: string,
  after: string,
  render: () => Promise<void>,
): Promise<void> {
  const field = page.locator(selector);
  await field.fill(before);
  await page.evaluate((sel) => {
    const el = document.querySelector<HTMLInputElement>(sel)!;
    el.focus();
    el.select();
  }, selector);
  await render();
  await page.keyboard.insertText(after);
  await expect(field, selector).toHaveValue(after);
  await expect(field, selector).toBeFocused();
}

for (const tag of ['', ' @phone']) {
  test.describe(`the fields of the views over a render (#361)${tag}`, () => {
    test('„Flotte“: the target', async ({ page }) => {
      const w = watch(page);
      const name = uniqueName('FeldFlotte');
      await register(page, name);
      seed({ name, ships: { probe: 3 }, res: { m: 0, c: 0, d: 10000 } });
      await page.goto('/?view=fleet');
      const render = () => pollRender(page, name);
      await typedOver(page, '#t_g', '2', '1', render);
      await typedOver(page, '#t_s', '3', '1', render);
      await typedOver(page, '#t_p', '7', '4', render);
      expect(w.problems).toEqual([]);
    });

    test('„Marktplatz“: the amount', async ({ page }) => {
      const w = watch(page);
      const name = uniqueName('FeldMarkt');
      await register(page, name);
      seed({
        name,
        b: { market: 1, robot: 4 },
        res: { m: 5000, c: 100, d: 0 },
        marketReset: true,
      });
      await page.reload();
      await nav(page, 'market');
      await typedOver(page, '#market-amount', '12', '3', () =>
        pollRender(page, name),
      );
      expect(w.problems).toEqual([]);
    });

    test('„Freunde“: the name of an invitation', async ({ page }) => {
      const w = watch(page);
      const name = uniqueName('FeldFreund');
      await register(page, name);
      await nav(page, 'friends');
      await typedOver(page, '#friend_name', 'Alt', 'Neu', () =>
        pollRender(page, name),
      );
      expect(w.problems).toEqual([]);
    });

    test('„Achievements“: the search', async ({ page }) => {
      const w = watch(page);
      const name = uniqueName('FeldErfolg');
      await register(page, name);
      await nav(page, 'achievements');
      await typedOver(page, '#achievement_search', 'flo', 'bau', () =>
        pollRender(page, name),
      );
      expect(w.problems).toEqual([]);
    });

    test('„Gilden“: a new guild, then the profile, a rank and the chat', async ({
      page,
    }) => {
      const w = watch(page);
      const name = uniqueName('FeldGilde');
      await register(page, name);
      await nav(page, 'guilds');
      const render = () => pollRender(page, name);
      const tag = guildTag('F');
      await typedOver(
        page,
        '#guild_name',
        'Alte Gilde',
        `Gilde ${tag}`,
        render,
      );
      await typedOver(page, '#guild_tag', 'X', tag, render);
      await page.getByRole('button', { name: 'Gilde gründen' }).click();
      await expect(
        page.getByRole('heading', { name: `[${tag}] Gilde ${tag}` }),
      ).toBeVisible();
      await typedOver(page, '#chat_text', 'Hallo', 'Servus', render);
      await typedOver(page, '#rank_new', 'Rang', 'Offizier', render);
      await typedOver(
        page,
        '#guild_description',
        'Alt',
        'Neu beschrieben',
        render,
      );
      expect(w.problems).toEqual([]);
    });

    test('„Admin“: the invitation, a setting, the message to all, and the dialogs', async ({
      page,
    }) => {
      const w = watch(page);
      const name = uniqueName('FeldAdmin');
      await register(page, name);
      expect(cli('admin', name)).toContain(`${name} is now admin.`);
      await page.reload();
      await nav(page, 'admin');
      const render = () => pollRender(page, name);
      await page.getByRole('tab', { name: 'Einladungen' }).click();
      await typedOver(page, '#inv_email', 'alt@x.de', 'neu@x.de', render);
      await page.getByRole('tab', { name: 'Universum' }).click();
      await typedOver(page, '#set_speed', '9', '5', render);
      await page.getByRole('tab', { name: 'Servernachricht' }).click();
      await typedOver(page, '#announce-text', 'Alt', 'Neu', render);
      // The dialogs stand in the modal, which a render does not touch.
      await page.getByRole('tab', { name: 'Universum' }).click();
      await page.getByRole('button', { name: 'Neue Runde starten' }).click();
      await typedOver(page, '#round-market-fee', '12', '7', render);
      await page.getByRole('button', { name: 'Abbrechen' }).click();
      await page.getByRole('button', { name: 'Endzeit einläuten' }).click();
      await typedOver(page, '#endzeit-minutes', '30', '20', render);
      await page.getByRole('button', { name: 'Abbrechen' }).click();
      expect(w.problems).toEqual([]);
    });
  });
}
