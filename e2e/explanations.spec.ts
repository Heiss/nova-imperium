// Explanation texts (#63): the „?“ opens the Lexicanum (#285).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { nav, register, seed, uniqueName, watch } from './helpers.ts';
// The display texts of the catalog entries (#113); `text` is a local name below.
import { text as entryText } from '../src/core/text.ts';

/** The paragraphs of a long text (#94): the lore, then „So funktioniert es:“. */
const lines = (text: string): string[] => text.split('\n\n');

test.describe('explanation texts (#63, the „?“ opens the Lexicanum since #285)', () => {
  const question = (page: Page, name: string): Locator =>
    page.getByRole('button', { name: `Erklärung zu ${name}` });
  const row = (page: Page, name: string): Locator =>
    page.locator('.item').filter({
      has: page.locator('.nm', { hasText: new RegExp(`^\\s*${name}\\b`) }),
    });
  const panel = (page: Page): Locator => page.locator('#lexicanum-panel');

  /** Chooses the display option in „Hilfe & Optionen“ and saves it. */
  async function choose(page: Page, label: string): Promise<void> {
    await nav(page, 'help');
    await page.getByLabel('(?)-Symbol').selectOption({ label });
    await page.click('[data-act=saveopt]');
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
  }

  test('the (?) opens the article by click and keyboard; the option changes the lists and survives a reload', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Lies');
    await register(page, name);
    seed({ name, b: { lab: 1, robot: 2, yard: 2 } });
    await page.goto('/?view=buildings');

    // Default „Anzeigen“ (D2): the short text is shown, the long one (#94)
    // is the introduction of the article in the side panel.
    const mine = row(page, 'Adamant-Tiefbohrung');
    const mineQ = question(page, 'Adamant-Tiefbohrung');
    await expect(mine.locator('.ds')).toHaveText(
      'Fördert Adamant, den wichtigsten Grundrohstoff.',
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'false');
    await mineQ.click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('metal')!.lt!),
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'true');
    await expect(mineQ).toHaveAttribute('aria-controls', 'lexicanum-panel');
    await expect(page.locator('#view .ex')).toHaveCount(0);
    // The (?) of another entry shows its article instead.
    await question(page, 'Psikristall-Steinbruch').click();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('crystal')!.lt!),
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    await nav(page, 'research');
    const spyQ = question(page, 'Auspex-Lehre');
    await spyQ.focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('spy')!.lt!),
    );
    await expect(spyQ).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(spyQ).toBeFocused();
    await page.keyboard.press('Space');
    await expect(panel(page)).toBeVisible();
    await spyQ.click();
    await expect(panel(page)).toHaveCount(0);

    // Ships and defense have the (?) and their article as well (#94).
    await nav(page, 'shipyard');
    await question(page, 'Spähschädel').click();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('probe')!.lt!),
    );
    await expect(question(page, 'Sonnenreliquiar')).toHaveCount(1);
    // The panel closes when its list is left.
    await nav(page, 'overview');
    await expect(panel(page)).toHaveCount(0);

    await choose(page, 'Ausblenden');
    await nav(page, 'buildings');
    await expect(page.locator('#view .exq')).toHaveCount(0);
    await expect(mine.locator('.ds')).toBeVisible();
    await page.reload();
    await expect(mine.locator('.ds')).toBeVisible();
    await expect(page.locator('#view .ex, #view .exq')).toHaveCount(0);
    await nav(page, 'research');
    await expect(row(page, 'Auspex-Lehre').locator('.ds')).toBeVisible();
    await expect(page.locator('#view .ex, #view .exq')).toHaveCount(0);
    await nav(page, 'help');
    await expect(page.getByLabel('(?)-Symbol')).toHaveValue('hidden');
    await choose(page, 'Anzeigen');
    await nav(page, 'buildings');
    await expect(mineQ).toBeVisible();
    expect(w.problems).toEqual([]);
  });

  test('a tap on the (?) opens the article as a page on a phone @phone', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Tipp'));
    await page.click('#tabbar [data-v=buildings]');
    await question(page, 'Sonnenkathedrale').tap();
    await expect(page).toHaveURL(/[?&]view=lexicanum&a=solar$/);
    await expect(page.locator('#view .lx-intro p')).toHaveText(
      lines(entryText('solar')!.lt!),
    );
    await expect(panel(page)).toHaveCount(0);
    await page.goBack();
    await expect(question(page, 'Sonnenkathedrale')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});
