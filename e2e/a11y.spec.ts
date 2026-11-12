import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { cli, nav, register, seed, uniqueName } from './helpers.ts';

// Automated accessibility check (axe, WCAG 2.1 A and AA), as in muffelblog. It
// finds a part of the problems only: it does not replace a look with a screen
// reader and the keyboard.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} [${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}]`,
  );
}

const VIEWS = [
  'overview',
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
  'admin',
];

test.describe('accessibility (axe)', () => {
  test('the check itself finds problems (so a pass means something)', async ({
    page,
  }) => {
    await page.setContent(
      '<!doctype html><html><body><img src="x.png"><button></button></body></html>',
    );
    const found = (await violations(page)).join('\n');
    expect(found).toContain('image-alt');
    expect(found).toContain('button-name');
    expect(found).toContain('document-title');
    expect(found).toContain('html-has-lang');
  });

  test('the login page has no violations', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#a_name')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test('every view of the game has no violations', async ({ page }) => {
    const name = uniqueName('Axe');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    const found: string[] = [];
    for (const view of VIEWS) {
      await nav(page, view);
      await expect(page.locator('#menu a.on')).toHaveAttribute('data-v', view);
      found.push(...(await violations(page)).map((v) => `${view}: ${v}`));
    }
    expect(found).toEqual([]);
  });

  test('the explanation texts have no violations, closed, opened and always shown (#63)', async ({
    page,
  }) => {
    const name = uniqueName('AxeEx');
    await register(page, name);
    seed({ name, b: { lab: 1, yard: 2 } });
    await page.reload();
    const found: string[] = [];
    const check = async (label: string): Promise<void> => {
      found.push(...(await violations(page)).map((v) => `${label}: ${v}`));
    };
    for (const [view, entry] of [
      ['buildings', 'Metallmine'],
      ['research', 'Energietechnik'],
    ] as const) {
      await nav(page, view);
      await check(`${view} closed`);
      await page.getByRole('button', { name: `Erklärung zu ${entry}` }).click();
      await expect(page.locator('#view .ex').first()).toBeVisible();
      await check(`${view} opened`);
    }
    await nav(page, 'help');
    await page
      .getByLabel('Erklärungstexte')
      .selectOption({ label: 'Immer anzeigen' });
    await page.click('[data-act=saveopt]');
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
    await check('help');
    for (const view of ['buildings', 'research'] as const) {
      await nav(page, view);
      await expect(page.locator('#view .ex').first()).toBeVisible();
      await check(`${view} always`);
    }
    expect(found).toEqual([]);
  });
});
