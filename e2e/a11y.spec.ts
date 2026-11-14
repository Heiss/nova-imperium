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

  test('the fields, a full planet and the Weltenschmiede have no violations (#51)', async ({
    page,
  }) => {
    const name = uniqueName('AxeFeld');
    await register(page, name);
    const found: string[] = [];
    const check = async (label: string): Promise<void> => {
      found.push(...(await violations(page)).map((v) => `${label}: ${v}`));
    };
    // Full, with the Weltenschmiede short of energy in its row.
    seed({
      name,
      b: { robot: 10, nanite: 1, solar: 13, metal: 40, crystal: 40, deut: 59 },
      research: { energy: 12 },
    });
    await page.reload();
    await expect(page.locator('.kv')).toContainText('163/163 Felder');
    await check('overview full');
    await nav(page, 'buildings');
    await expect(page.locator('#fields')).toHaveText('Felder: 163 / 163');
    await check('buildings full');
    // Free fields: the Weltenschmiede waits for energy.
    seed({ name, b: { robot: 10, nanite: 1, solar: 13 } });
    await page.reload();
    await expect(page.locator('#view')).toContainText('Zu wenig Energie');
    await check('buildings energy');
    seed({ name, unlimited: true });
    await page.reload();
    await expect(page.locator('#fields')).toHaveText('Felder: 24 / unbegrenzt');
    await check('buildings unlimited');
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
      ['buildings', 'Adamant-Tiefbohrung'],
      ['research', 'Machina-Energetik'],
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

  test('the tab „Fehler“ and the dialog „Problem melden“ have no violations (#126)', async ({
    page,
  }) => {
    const name = uniqueName('AxeErr');
    await register(page, name);
    cli('admin', name);
    seed({ name, serverError: 'Axe-Testfehler' });
    await page.reload();
    const found: string[] = [];
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Fehler' }).click();
    const row = page.getByRole('row', { name: /Axe-Testfehler/ });
    await row.getByText(/^Eintrag \d+$/).click();
    await expect(row.locator('pre')).toBeVisible();
    found.push(...(await violations(page)).map((v) => `errors: ${v}`));
    await nav(page, 'buildings');
    await page.route(
      '**/api/action',
      (route) =>
        route.fulfill({ status: 500, json: { error: 'Serverfehler.' } }),
      { times: 1 },
    );
    await page.click('[data-act=build][data-k=metal]');
    const offer = page.getByRole('button', { name: 'Problem melden' });
    await expect(offer).toBeVisible();
    found.push(...(await violations(page)).map((v) => `toast: ${v}`));
    await offer.click();
    await expect(page.locator('#reportform-dialog')).toBeVisible();
    found.push(...(await violations(page)).map((v) => `dialog: ${v}`));
    expect(found).toEqual([]);
  });

  test('the guild view with its ranks has no violations (#163)', async ({
    page,
    browser,
  }) => {
    const lead = uniqueName('AxeGilde');
    const tag = `A${Date.now() % 1000000}`;
    const title = `[${tag}] Axe ${tag}`;
    await register(page, lead);
    const found: string[] = [];
    const check = async (p: Page, label: string): Promise<void> => {
      found.push(...(await violations(p)).map((v) => `${label}: ${v}`));
    };
    await nav(page, 'guilds');
    await check(page, 'directory');
    await page.getByLabel('Kürzel').fill(tag);
    await page.getByLabel('Name', { exact: true }).fill(`Axe ${tag}`);
    await page.getByRole('button', { name: 'Gilde gründen' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByLabel('Name des neuen Rangs').fill('Offizier');
    await page.getByRole('button', { name: 'Rang anlegen' }).click();
    await expect(page.locator('fieldset.rank')).toHaveCount(3);
    // The public page, for an applicant.
    // axe needs a page of its own context.
    const context = await browser.newContext();
    const other = await context.newPage();
    await register(other, uniqueName('AxeGast'));
    await nav(other, 'guilds');
    await other.getByRole('link', { name: title }).click();
    await check(other, 'public');
    await other.getByRole('button', { name: 'Bewerben' }).click();
    await expect(other.getByText('Deine Bewerbung ist offen.')).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Annehmen' })).toBeVisible();
    await check(page, 'Leitung with ranks and an application');
    await page.getByRole('button', { name: 'Annehmen' }).click();
    await expect(page.locator('select[id^=rank_of_]')).toHaveCount(1);
    await check(page, 'Leitung with a member');
    await other.reload();
    await expect(other.locator('fieldset.rank')).toHaveCount(3);
    await check(other, 'member');
    await context.close();
    expect(found).toEqual([]);
  });
});
