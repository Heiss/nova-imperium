import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { text as entryText } from '../src/core/text.ts';
import { nav, register, seed, uniqueName, watch } from './helpers.ts';

// The Lexicanum, stage 1 (#285): the „?“ of a list entry opens the article
// in a side panel on a desktop and the page on a phone; „Im Lexicanum
// öffnen“, links, the address, the search, the player's own state, the
// option „(?)-Symbol“ and axe.

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function axe(page: Page, label: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) =>
      `${label}: ${v.id}: ${v.help} [${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}]`,
  );
}

const question = (page: Page, name: string): Locator =>
  page.getByRole('button', { name: `Erklärung zu ${name}` });
const panel = (page: Page): Locator => page.locator('#lexicanum-panel');
const heading = (page: Page): Locator => page.locator('#view .lx-title');
const row = (page: Page, name: string): Locator =>
  page.locator('.item').filter({
    has: page.locator('.nm', { hasText: new RegExp(`^\\s*${name}\\b`) }),
  });
const search = (page: Page): Locator =>
  page.getByRole('combobox', { name: 'Suche im Lexicanum' });

/** How far the page reaches past the screen, with a pixel for rounding. */
const overflow = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

test.describe('Lexicanum (#285)', () => {
  test('the „?“ opens the side panel, its link the page; links, address, search and own state', async ({
    page,
  }) => {
    const w = watch(page);
    const found: string[] = [];
    const name = uniqueName('Lexi');
    await register(page, name);
    seed({ name, b: { lab: 6 }, research: { spy: 4 }, ships: { probe: 12 } });
    await page.goto('/?view=research');

    // The „?“ opens the article beside the list; nothing unfolds below it.
    const q = question(page, 'Auspex-Lehre');
    await expect(q).toHaveAttribute('aria-expanded', 'false');
    await q.click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page)).toBeFocused();
    await expect(q).toHaveAttribute('aria-expanded', 'true');
    await expect(q).toHaveAttribute('aria-controls', 'lexicanum-panel');
    await expect(page.locator('#view .ex')).toHaveCount(0);
    await expect(panel(page).locator('.lx-title')).toContainText(
      'Auspex-Lehre',
    );
    // The long text of the catalog is the introduction (#63).
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      entryText('spy')!.lt!.split('\n\n'),
    );
    await expect(panel(page)).not.toContainText('Suche im Lexicanum');
    // The own level and „Dein Stand“ with the player's numbers (B5).
    await expect(panel(page).locator('.lx-have')).toHaveText('deine Stufe 4');
    await expect(panel(page).locator('.lx-me')).toContainText(
      'Dein Stand: Stufe 4 und 12 Spähschädel.',
    );
    // The level table: the own level marked, then the same cost as the list.
    const levels = panel(page).locator('table.lx-levels tbody tr');
    await expect(levels.first()).toHaveClass(/lx-cur/);
    await expect(levels.first().locator('th')).toContainText('4');
    await expect(levels.nth(1).locator('th')).toHaveText('5');
    await expect(levels.nth(1).locator('.cost')).toHaveText(
      (await row(page, 'Auspex-Lehre').locator('.cost').textContent())!,
    );
    found.push(...(await axe(page, 'panel')));

    // Esc closes it and gives the focus back to the „?“.
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
    await expect(q).toBeFocused();
    await expect(q).toHaveAttribute('aria-expanded', 'false');
    // The keyboard opens it as well; „Schließen“ closes it.
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole('button', { name: 'Schließen' }).click();
    await expect(panel(page)).toHaveCount(0);

    // „Im Lexicanum öffnen“ opens the same article on the page.
    await q.click();
    await panel(page)
      .getByRole('link', { name: /Im Lexicanum öffnen/ })
      .click();
    await expect(page).toHaveURL(/[?&]view=lexicanum&a=spy$/);
    await expect(heading(page)).toContainText('Auspex-Lehre');
    await expect(panel(page)).toHaveCount(0);
    await expect(page.locator('#menu [data-v=lexicanum]')).toHaveClass(/on/);
    found.push(...(await axe(page, 'article')));

    // A link leads to another article; the address survives a reload; back works.
    await page
      .locator('#view .lx-art p')
      .getByRole('link', { name: 'Spähschädel' })
      .click();
    await expect(page).toHaveURL(/a=probe$/);
    await expect(heading(page)).toContainText('Spähschädel');
    await expect(page.locator('#view .lx-have')).toHaveText('vorhanden: 12');
    await page.reload();
    await expect(heading(page)).toContainText('Spähschädel');
    await page.goBack();
    await expect(heading(page)).toContainText('Auspex-Lehre');

    // The search: „/“ focuses it; name, abbreviation, a word of the text, a keyword.
    await page.locator('#view h2').click();
    await page.keyboard.press('/');
    await expect(search(page)).toBeFocused();
    const first = page.getByRole('option').first();
    for (const [query, title] of [
      ['Kogitator', 'Kogitator-Doktrin'],
      ['KD', 'Kogitator-Doktrin'],
      ['Flottenslot', 'Kogitator-Doktrin'],
      ['ausspähen', 'Auspex-Lehre'],
      // Everyday keywords of an entry and of a mission (owner, 2026-11-17).
      ['Sprit', 'Promethium-Raffinerie'],
      ['plündern', 'Sturmangriff'],
    ] as const) {
      await search(page).fill(query);
      await expect(first).toContainText(title);
    }
    await expect(page.locator('.lx-rf')).toContainText('Treffer');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('option')).toHaveCount(0);
    await search(page).fill('Sturmangriff');
    await page.keyboard.press('ArrowDown');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/a=mission-attack$/);
    await expect(heading(page)).toContainText('Sturmangriff');

    // The start page from the menu, a list, a mission.
    await nav(page, 'lexicanum');
    await expect(page).toHaveURL(/[?&]view=lexicanum$/);
    found.push(...(await axe(page, 'start')));
    await page.getByRole('link', { name: /Missionen/ }).click();
    await page.getByRole('link', { name: 'Auspex-Erkundung' }).click();
    await expect(heading(page)).toContainText('Auspex-Erkundung');
    await expect(page.locator('#view .lx-facts')).toContainText(
      'nur Spähschädel',
    );
    // What happens on arrival, before the facts.
    await expect(page.locator('#view')).toContainText(
      'Am Ziel entsteht ein Auspex-Bericht',
    );
    await search(page).fill('Gegner');
    found.push(...(await axe(page, 'search')));
    expect(found).toEqual([]);
    expect(w.problems).toEqual([]);
  });

  test('the option „(?)-Symbol“ shows or hides the „?“ and survives a reload', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('LexOpt');
    await register(page, name);
    const choose = async (label: string): Promise<void> => {
      await nav(page, 'help');
      await page.getByLabel('(?)-Symbol').selectOption({ label });
      await page.click('[data-act=saveopt]');
      await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
    };
    await nav(page, 'help');
    await expect(page.locator('#o_explain option')).toHaveText([
      'Anzeigen',
      'Ausblenden',
    ]);
    await choose('Ausblenden');
    await nav(page, 'buildings');
    await expect(page.locator('#view .exq')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#view .item').first()).toBeVisible();
    await expect(page.locator('#view .exq')).toHaveCount(0);
    // Without the „?“ the Lexicanum is reached through the menu.
    await nav(page, 'lexicanum');
    await expect(page.locator('#view h2')).toHaveText('Lexicanum');
    await choose('Anzeigen');
    await nav(page, 'buildings');
    await expect(question(page, 'Sonnenkathedrale')).toBeVisible();
    expect(w.problems).toEqual([]);
  });

  test('on a phone the „?“ opens the page, which fits a 360 px screen @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const found: string[] = [];
    await page.setViewportSize({ width: 360, height: 740 });
    const name = uniqueName('LexPhone');
    await register(page, name);
    seed({ name, b: { lab: 3 }, research: { spy: 2 } });
    await page.click('#tabbar [data-v=buildings]');
    await question(page, 'Sonnenkathedrale').tap();
    await expect(page).toHaveURL(/[?&]view=lexicanum&a=solar$/);
    await expect(heading(page)).toContainText('Sonnenkathedrale');
    await expect(panel(page)).toHaveCount(0);
    // The words before the level table, with numbers of the rules.
    await expect(page.locator('#view')).toContainText(
      'Die Energie wächst schneller als die Stufe',
    );
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    found.push(...(await axe(page, 'phone article')));
    await page.goBack();
    await expect(page.locator('#view h2')).toContainText('Gebäude');

    // The page of the Auspex-Lehre with its wide tables; the start under „Mehr“.
    await page.goto('/?view=lexicanum&a=spy');
    await expect(heading(page)).toContainText('Auspex-Lehre');
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    // A mine: its rate assumes enough energy, and the heading says so.
    await page.goto('/?view=lexicanum&a=metal');
    await expect(page.locator('#view')).toContainText(
      'Adamant/h bei voller Energie',
    );
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    await nav(page, 'lexicanum');
    await expect(page.locator('.lx-cat').first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    // The text of a mission below its hit fits the screen.
    await search(page).fill('Sturmangriff');
    await expect(page.getByRole('option').first()).toContainText(
      'Am Ziel kämpft die Flotte',
    );
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    found.push(...(await axe(page, 'phone start')));
    expect(found).toEqual([]);
    expect(w.problems).toEqual([]);
  });
});
