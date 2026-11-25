// Layout and display: the phone layout with its tab bar, and the planet
// animations.
import { expect, test } from '@playwright/test';
import { nav, register, uniqueName, watch, optionsSection } from './helpers.ts';

test.describe('playing', () => {
  test('the layout works on a phone @phone', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Handy'));
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('#tabbar')).toBeVisible();
    const overflow = (): Promise<number> =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
    await page.click('#tabbar [data-v=buildings]');
    await expect(page.locator('#tabbar a.on')).toHaveAttribute(
      'data-v',
      'buildings',
    );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.click('#tabbar [data-act=moreOpen]');
    await expect(page.locator('#more')).toBeVisible();
    // The Sternenkarte is a tab since #189; a view of the sheet is the highscore.
    await page.click('#more-list [data-v=highscore]');
    await expect(page.locator('#more')).toBeHidden();
    await expect(page.locator('h2')).toContainText('Highscore');
    await expect(page.locator('#tabbar [data-act=moreOpen]')).toHaveClass(/on/);
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('planet animations can be turned off for this device', async ({
    page,
  }) => {
    await register(page, uniqueName('Ruhe'));
    const surface = page.locator('.pl .pl-surface');
    await expect(surface).not.toHaveCSS('animation-name', 'none');
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    await page.getByLabel('Animationen').uncheck();
    await nav(page, 'overview');
    await expect(surface).toHaveCSS('animation-name', 'none');
    await page.reload();
    await expect(surface).toHaveCSS('animation-name', 'none');
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    await expect(page.getByLabel('Animationen')).not.toBeChecked();
  });

  test('the chosen section of „Optionen“ shows the focus ring of the keyboard (#356)', async ({
    page,
  }) => {
    await register(page, uniqueName('Fokus'));
    await nav(page, 'help');
    await optionsSection(page, 'Konto');
    const chosen = page
      .getByRole('group', { name: 'Bereich' })
      .getByRole('button', { name: 'Konto', exact: true });
    await expect(chosen).toHaveAttribute('aria-pressed', 'true');
    // Reached by the keyboard: from the button before it.
    await page
      .getByRole('group', { name: 'Bereich' })
      .getByRole('button', { name: 'Runde', exact: true })
      .focus();
    await page.keyboard.press('Tab');
    await expect(chosen).toBeFocused();
    const ring = await chosen.evaluate((el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      const group = el.parentElement!.getBoundingClientRect();
      const width = parseFloat(style.outlineWidth);
      // The outer edge of the ring: the border box grown by offset and width.
      const grow = parseFloat(style.outlineOffset) + width;
      const tolerance = 0.5;
      return {
        style: style.outlineStyle,
        width,
        // The whole ring lies inside the switch, which clips what is outside.
        inside:
          box.left - grow >= group.left - tolerance &&
          box.right + grow <= group.right + tolerance &&
          box.top - grow >= group.top - tolerance &&
          box.bottom + grow <= group.bottom + tolerance,
      };
    });
    expect(ring.style).not.toBe('none');
    expect(ring.width).toBeGreaterThan(0);
    expect(ring.inside).toBe(true);
  });
});
