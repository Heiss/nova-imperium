// Every page renders without CSP violations or script errors, and the URL
// restores the view on reload and browser navigation.
import { expect, test } from '@playwright/test';
import { nav, register, uniqueName, watch } from './helpers.ts';

test.describe('playing', () => {
  test('every page renders without CSP violations or script errors', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Tour'));
    for (const view of [
      'buildings',
      'resources',
      'research',
      'shipyard',
      'defense',
      'fleet',
      'galaxy',
      'messages',
      'highscore',
      'news',
      'help',
      'overview',
    ]) {
      await nav(page, view);
      await expect(page.locator('#menu a.on')).toHaveAttribute('data-v', view);
    }
    await expect(page.locator('.pl .pl-surface')).toHaveCSS(
      'background-image',
      /\/planets\/[a-z]+-[0-2]-surface\.svg/,
    );
    await expect(page.locator('.kv')).toContainText('Planetentyp');
    expect(w.problems).toEqual([]);
  });

  test('the URL restores the view on reload and browser navigation', async ({
    page,
  }) => {
    await register(page, uniqueName('Nav'));
    const selected = page.locator('#menu a.on');
    await nav(page, 'buildings');
    await expect(page).toHaveURL(/\?view=buildings$/);
    await page.reload();
    await expect(selected).toHaveAttribute('data-v', 'buildings');
    await nav(page, 'research');
    await page.goBack();
    await expect(selected).toHaveAttribute('data-v', 'buildings');
    await page.goForward();
    await expect(selected).toHaveAttribute('data-v', 'research');
  });
});
