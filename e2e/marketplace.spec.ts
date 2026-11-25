// The marketplace (#171, okf/features/marketplace.md): on a planet with a
// Handelsposten a player exchanges one resource for another; the preview
// shows the result, the fee and the cap, „max“ fills the field, the price of
// the pair falls with the amount. The admin switches the market off for the
// round: the view is hidden (#404, e2e/hide-switched-off.spec.ts) and the
// server refuses every exchange; the panel warns about ratios that gain on a
// round trip. Desktop and phone, with axe on the form. The market is shared by all
// players of the universe, so the tests run one after the other and put the
// settings back.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { cli, nav, register, seed, uniqueName, watch } from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const CLOSED = 'Der Marktplatz ist in dieser Runde geschlossen.';
const RATIO = 'Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant)';

test.describe.configure({ mode: 'serial' });

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const lastToast = (page: Page): Locator => page.locator('.toast').last();

/** An action as from another device: the refusal of the server. */
const refusal = (page: Page, data: object): Promise<string | undefined> =>
  page.evaluate(async (body) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return ((await r.json()) as { error?: string }).error;
  }, data);

async function exchangeFlow(page: Page): Promise<void> {
  const { problems } = watch(page);
  const player = uniqueName('Haendler');
  await register(page, player);
  seed({
    name: player,
    b: { market: 1, robot: 4 },
    res: { m: 5000, c: 100, d: 0 },
    marketReset: true,
  });
  await page.reload();
  await nav(page, 'market');
  await expect(page.locator('h2')).toContainText('Marktplatz');
  const form = page.locator('#marketform');
  const trade = form.getByRole('button', { name: 'Tauschen' });
  const preview = page.locator('#market-preview');

  // The rate of the pair at the default ratio and the fee of level 1.
  await expect(preview).toContainText('450 Psikristall je 1.000 Adamant');
  await expect(preview).toContainText('10 %');
  await expect(trade).toBeDisabled();
  expect(await violations(page)).toEqual([]);

  // What to get never offers what is given.
  const get = form.getByLabel('Du erhältst');
  await expect(get.locator('option')).toHaveText(['Psikristall', 'Promethium']);
  await form.getByLabel('Du gibst').selectOption('c');
  await expect(get.locator('option')).toHaveText(['Adamant', 'Promethium']);
  await form.getByLabel('Du gibst').selectOption('m');

  // The preview follows the amount; a refusal shows the words of the server.
  const amount = form.getByLabel('Menge');
  await amount.fill('1000');
  await expect(preview).toContainText('1.000 Adamant');
  await expect(preview).toContainText('450 Psikristall');
  await expect(preview).toContainText('50 Psikristall (10 %)');
  await expect(trade).toBeEnabled();
  await amount.fill('999999');
  await expect(preview).toContainText(
    'So viel hast du auf diesem Planeten nicht.',
  );
  await expect(trade).toBeDisabled();

  // „max“ gives the whole stock of Adamant (the free storage is large).
  await form.getByRole('button', { name: 'max' }).click();
  await expect(amount).toHaveValue(/^[1-9]\d{3}$/);
  await amount.fill('1000');

  await trade.click();
  await expect(lastToast(page)).toContainText(
    '1.000 Adamant gegen 450 Psikristall getauscht.',
  );
  await expect(amount).toHaveValue('');

  // The price of the pair fell with the amount: the same amount gives less.
  await amount.fill('1000');
  await expect(preview).toContainText('447 Psikristall');
  expect(await violations(page)).toEqual([]);
  expect(problems).toEqual([]);
}

test('a player exchanges resources at the Handelsposten', async ({ page }) => {
  await exchangeFlow(page);
});

test('exchanging on a phone @phone', async ({ page }) => {
  await exchangeFlow(page);
});

test('a planet without a Handelsposten says what is missing', async ({
  page,
}) => {
  await register(page, uniqueName('OhnePosten'));
  await nav(page, 'market');
  await expect(page.locator('#view')).toContainText(
    'Auf diesem Planeten fehlt ein Handelsposten. Baue ihn unter „Gebäude“.',
  );
  await expect(page.locator('#marketform')).toHaveCount(0);
  expect(
    await refusal(page, { type: 'trade', give: 'm', get: 'c', amount: 1 }),
  ).toBe('Auf diesem Planeten fehlt ein Handelsposten.');
});

test('the admin switches the market off for the round and sees the warning', async ({
  page,
}) => {
  const name = uniqueName('Marktwart');
  await register(page, name);
  cli('admin', name);
  seed({
    name,
    b: { market: 1, robot: 4 },
    res: { m: 5000, c: 100, d: 0 },
    marketReset: true,
  });
  await page.reload();
  const settings = async (on: string, ratio: string): Promise<void> => {
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    // The limit of the day (0 = unlimited) and the two values of the fee are
    // settings of the round too (owner, 2026-11-19).
    await expect(
      page.getByLabel(
        'Marktplatz Tageslimit je Spieler (Einheiten, 0 = unbegrenzt)',
      ),
    ).toHaveValue('100000');
    await expect(
      page.getByLabel(
        'Marktplatz Gebühr auf Stufe 1 des Handelspostens (Prozent)',
      ),
    ).toHaveValue('10');
    await expect(
      page.getByLabel(
        'Marktplatz Gebühr sinkt je weitere Stufe um (Prozentpunkte)',
      ),
    ).toHaveValue('1');
    await page.getByLabel('Marktplatz aktiv', { exact: true }).selectOption(on);
    await page.getByLabel(RATIO, { exact: true }).fill(ratio);
    await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
    await expect(lastToast(page)).toContainText('Einstellungen gespeichert.');
  };
  try {
    await settings('0', '501');
    await expect(page.getByRole('alert')).toContainText(
      'Achtung: Ein Tausch im Kreis bringt selbst ohne Gebühr Gewinn: Adamant → Psikristall → Adamant',
    );
    // Hidden, not shown as closed (#404): no entry, the address opens the overview.
    await expect(page.locator('#menu [data-v=market]')).toHaveCount(0);
    await page.goto('/?view=market');
    await expect(page.locator('h2')).toContainText('Übersicht');
    expect(
      await refusal(page, { type: 'trade', give: 'm', get: 'c', amount: 1000 }),
    ).toBe(CLOSED);
  } finally {
    await settings('1', '500');
  }
  await expect(page.getByRole('alert')).toHaveCount(0);
  await nav(page, 'market');
  await expect(page.locator('#marketform')).toBeVisible();
});
