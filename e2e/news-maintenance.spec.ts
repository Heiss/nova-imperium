// „Neuigkeiten“ (#81) and the maintenance page (#80, #81): the news of a new
// version and the game that loads after maintenance.
import { expect, test } from '@playwright/test';
import { nav, register, uniqueName, watch } from './helpers.ts';

test('shows „Neuigkeiten“ with a dot until opened on this device (#81)', async ({
  page,
}) => {
  const w = watch(page);
  // The E2E server has no released CHANGELOG.md: the test brings its own.
  await page.route('**/api/news', (route) =>
    route.fulfill({
      json: {
        version: '26.11.1',
        versions: [
          {
            version: '26.11.1',
            date: '12.11.2026',
            entries: [{ kind: 'neu', text: 'Neuigkeiten im Menü.' }],
          },
          {
            version: '26.11.0',
            date: '01.11.2026',
            entries: [{ kind: 'behoben', text: 'Ein Fehler ist weg.' }],
          },
        ],
      },
    }),
  );
  await register(page, uniqueName('Leser'));
  const badge = page.locator('#menu [data-v=news] .badge');
  await expect(badge).toHaveAttribute('aria-label', 'Neu in Version 26.11.1');
  await nav(page, 'news');
  await expect(page.locator('h2')).toHaveText('Neuigkeiten');
  await expect(
    page.getByText('Version 26.11.1 – 12.11.2026', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Ein Fehler ist weg.')).toBeVisible();
  await expect(badge).toHaveCount(0);
  await page.goto('/?view=overview');
  await expect(page.locator('#menu [data-v=news]')).toBeVisible();
  await expect(badge).toHaveCount(0);
  expect(w.problems).toEqual([]);
});

test('loads the news of the new version after maintenance (#81)', async ({
  page,
}) => {
  const news = (version: string) => ({
    version,
    versions: [
      {
        version,
        date: '12.11.2026',
        entries: [{ kind: 'neu', text: `Neu in ${version}.` }],
      },
    ],
  });
  let version = '26.11.1';
  let down = false;
  await page.route('**/api/news', (route) =>
    route.fulfill({ json: news(version) }),
  );
  await page.route('**/api/state**', (route) =>
    down
      ? route.fulfill({
          status: 503,
          headers: { 'nova-maintenance': 'update', 'retry-after': '30' },
          json: {
            error: 'Nova Imperium wird aktualisiert.',
            maintenance: 'update',
          },
        })
      : route.continue(),
  );
  await register(page, uniqueName('Update'));
  await page.clock.install();
  await page.goto('/?view=news');
  await expect(page.getByText('Neu in 26.11.1.')).toBeVisible();
  down = true;
  await page.clock.fastForward(4000);
  await expect(page.locator('#maintenance')).toBeVisible();
  version = '26.11.2';
  down = false;
  await page.clock.fastForward(15000);
  await expect(page.locator('#maintenance')).toHaveCount(0);
  await expect(page.getByText('Neu in 26.11.2.')).toBeVisible();
  await page.goto('/?view=overview');
  await expect(page.locator('#menu [data-v=news] .badge')).toHaveCount(0);
});

test('loads the game after maintenance that interrupted the first load (#80)', async ({
  page,
}) => {
  const name = uniqueName('wartung');
  await register(page, name);
  await page.clock.install();
  let first = true;
  await page.route('**/api/state', async (route) => {
    if (!first) return route.continue();
    first = false;
    await route.fulfill({
      status: 503,
      headers: { 'nova-maintenance': 'update', 'retry-after': '30' },
      contentType: 'application/json',
      body: JSON.stringify({
        error: 'Nova Imperium wird aktualisiert.',
        maintenance: 'update',
      }),
    });
  });
  await page.goto('/');
  await expect(page.locator('#maintenance')).toContainText(
    'Wartung – Nova Imperium wird aktualisiert.',
  );
  await page.clock.fastForward(15000);
  await expect(page.locator('#maintenance')).toHaveCount(0);
  await expect(page.locator('h2')).toContainText('Übersicht');
});
