// „Optionen“ stays where the player has it (#355, owner, 2026-11-22): a
// render that is not fresh (the poll after a change of the state, the news,
// the save of a switch) keeps the page, so neither the scroll position nor
// the place of a switch moves by anything but the player's own scroll, and a
// tap lands where the player aimed. Every section of the phone switch and the
// desktop. The renders are told by what they draw outside „Optionen“: the
// mark of „Neuigkeiten“ in the menu (the news) and the choice of the planet
// in the header (the poll after a new colony), so nothing here depends on a
// node of the page being replaced.
import { expect, test, type Page } from '@playwright/test';
import {
  nav,
  optionsSection,
  register,
  seed,
  uniqueName,
  watch,
  withWebPush,
} from './helpers.ts';

const SECTIONS = ['Spiel', 'Runde', 'Konto', 'Gerät', 'Weiteres'] as const;
const NEWS_MARK = '#menu [data-v=news] .badge';

/**
 * Starts a watch of the scroll position: from now on, the page itself scrolls
 * by 2 px a frame (back at the ends), and every frame in which `scrollY` is
 * not where that scroll left it is noted. `stop()` ends the watch after three
 * more frames and gives the moves the scroll did not cause.
 */
async function watchScroll(page: Page): Promise<() => Promise<string[]>> {
  await page.evaluate(() => {
    const w = window as unknown as {
      steady?: { moves: string[]; running: boolean };
    };
    const state = { moves: [] as string[], running: true };
    w.steady = state;
    const max = document.documentElement.scrollHeight - innerHeight;
    let dir = 1;
    let expected = scrollY;
    const frame = () => {
      if (!state.running) return;
      if (Math.abs(scrollY - expected) > 1)
        state.moves.push(`${Math.round(expected)} -> ${Math.round(scrollY)}`);
      if (scrollY >= max - 2) dir = -1;
      if (scrollY <= 2) dir = 1;
      scrollBy(0, 2 * dir);
      expected = scrollY;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  // Three more frames before the end, so a move by the last render is seen by
  // a frame of the watch (review of #347).
  return () =>
    page.evaluate(
      () =>
        new Promise<string[]>((resolve) => {
          const w = window as unknown as {
            steady: { moves: string[]; running: boolean };
          };
          requestAnimationFrame(() =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => {
                w.steady.running = false;
                resolve(w.steady.moves);
              }),
            ),
          );
        }),
    );
}

/** „Optionen“ at one section, scrolled to the middle of what it can scroll. */
async function openSection(page: Page, section: string): Promise<void> {
  await optionsSection(page, section as (typeof SECTIONS)[number]);
  await page.evaluate(() =>
    scrollTo(0, (document.documentElement.scrollHeight - innerHeight) / 2),
  );
}

/** A new colony on slot `p` of the home system; the poll draws it into the header. */
async function pollRender(page: Page, name: string, p: number): Promise<void> {
  const options = page.locator('#planet_select option');
  const before = await options.count();
  seed({ name, colony: { p, name: uniqueName('Ruhepol') } });
  await expect(options).toHaveCount(Math.max(before, 1) + 1, {
    timeout: 15000,
  });
}

/** Registers, with the news held until `release` is called. */
async function start(
  page: Page,
): Promise<{ name: string; release: () => void }> {
  await withWebPush(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/news', async (route) => {
    await held;
    await route.continue();
  });
  const name = uniqueName('Ruhig');
  await register(page, name);
  await nav(page, 'help');
  await expect(page.locator(NEWS_MARK)).toHaveCount(0);
  // The page loads two of its boxes once when it is opened: the round
  // archive and „Meine Aktivität & Spielzeit“. That one-time load is not a
  // render, and where it grows a box above the viewport the browser's scroll
  // anchoring changes scrollY to keep the content in place (#355). The
  // measuring starts once both have answered, so it counts the renders only.
  await expect(page.locator('#view')).toContainText(
    'Jede beendete Runde, an der du teilgenommen hast',
  );
  await expect(page.locator('#own-activity')).not.toHaveText(/Wird geladen/);
  return { name, release };
}

for (const tag of ['', ' @phone']) {
  test.describe(`„Optionen“ stays still over a render (#355)${tag}`, () => {
    test('while the page is scrolled, in every section: the news and the poll move nothing', async ({
      page,
    }) => {
      const w = watch(page);
      const { name, release } = await start(page);
      const phone = (page.viewportSize()?.width ?? 1280) <= 760;
      let slot = 10;
      for (const section of phone ? SECTIONS : (['Spiel'] as const)) {
        await openSection(page, section);
        const stop = await watchScroll(page);
        if (section === 'Spiel') {
          release();
          await expect(page.locator(NEWS_MARK)).toHaveCount(1);
        }
        await pollRender(page, name, slot++);
        expect(await stop(), section).toEqual([]);
      }
      expect(w.problems).toEqual([]);
    });

    test('the switches of „Benachrichtigungen“: a tap and the renders after it move nothing, the next tap hits its switch', async ({
      page,
    }) => {
      const w = watch(page);
      const { name, release } = await start(page);
      release();
      await expect(page.locator(NEWS_MARK)).toHaveCount(1);
      await optionsSection(page, 'Gerät');
      await page.evaluate(() =>
        document.getElementById('push_delivery')!.scrollIntoView({
          block: 'center',
        }),
      );
      const aimed = page.locator('#push_research');
      const at = (await aimed.boundingBox())!;
      const y = await page.evaluate(() => scrollY);
      // Three switches in a row, each saved (two renders each), and a poll.
      for (const id of ['push_shipyard', 'push_spied', 'push_news']) {
        const box = page.locator(`#${id}`);
        const was = await box.isChecked();
        await box.tap().catch(() => box.click());
        await expect(box).toBeChecked({ checked: !was });
        await expect(page.locator('.toast').last()).toContainText(
          'Gespeichert.',
        );
      }
      await pollRender(page, name, 10);
      expect(await page.evaluate(() => scrollY)).toBe(y);
      expect(await aimed.boundingBox()).toEqual(at);
      // A tap where the player saw „Forschung abgeschlossen“ switches it.
      const before = await aimed.isChecked();
      const middle = { x: at.x + at.width / 2, y: at.y + at.height / 2 };
      if ((page.viewportSize()?.width ?? 1280) <= 760)
        await page.touchscreen.tap(middle.x, middle.y);
      else await page.mouse.click(middle.x, middle.y);
      await expect(aimed).toBeChecked({ checked: !before });
      await expect(page.locator('#push_spied')).not.toBeChecked();
      expect(w.problems).toEqual([]);
    });
  });
}
