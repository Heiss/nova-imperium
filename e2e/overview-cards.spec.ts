// The overview on a phone (#189, D5): the cards „Läuft“, „Achtung“ and
// „Bereit“ above the planet facts, the line „Bauschleife leer“ for another own
// place with its button „Wechseln“ (owner, 2026-11-20), and an incoming attack.
import { expect, test, type Page } from '@playwright/test';
import {
  expectShownPlace,
  galaxyAction,
  galaxyRow,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const card = (page: Page, title: string) =>
  page.locator('section.cards .card').filter({
    has: page.getByRole('heading', { name: title, exact: true }),
  });

test('the cards „Läuft“, „Achtung“ and „Bereit“ with the idle line and „Wechseln“ @phone', async ({
  page,
}) => {
  test.slow();
  const w = watch(page);
  const name = uniqueName('Uebersicht');
  await register(page, name);
  // The mines need energy and there is none: „Achtung“. A colony without a
  // build order: „Bereit“. Adamant for one upgrade.
  seed({
    name,
    b: { metal: 4 },
    res: { m: 50000, c: 50000, d: 50000 },
    colony: { name: 'Aussenposten' },
  });
  await page.reload();
  await expect(page.locator('h2')).toContainText('Übersicht');
  const cards = page.locator('section.cards');
  await expect(cards).toBeVisible();

  // Nothing runs on the shown place.
  await expect(card(page, 'Läuft')).toContainText('Es läuft gerade nichts.');
  await expect(card(page, 'Läuft').locator('progress')).toHaveCount(0);

  // „Achtung“: too little energy, with the link to the fix.
  const attention = card(page, 'Achtung');
  await expect(attention).toContainText(/Zu wenig Energie: es fehlen [\d.]+/);

  // „Bereit“: the colony has no building under construction; both places
  // do, so the line names the colony and offers „Wechseln“.
  const ready = card(page, 'Bereit');
  const idle = ready.locator('li', { hasText: 'Bauschleife leer: ' });
  await expect(idle).toHaveCount(1);
  await expect(idle).toContainText(/Aussenposten \[\d+:\d+:\d+\]/);
  await expect(idle.getByRole('button', { name: 'Wechseln' })).toBeVisible();

  // The link of „Achtung“ opens the buildings; start an upgrade there.
  await attention.getByRole('link', { name: 'Zu den Gebäuden' }).click();
  await expect(page.locator('h2')).toHaveText('Gebäude');
  await page.locator('[data-act=build][data-k=metal]').click();
  await expect(
    page.locator('.item', { has: page.locator('#exq_metal') }),
  ).toHaveAttribute('data-phase', 'running');
  await nav(page, 'overview');

  // „Läuft“ names the order with its bar; the colony is still idle.
  const running = card(page, 'Läuft');
  await expect(running).toContainText('Gebäude');
  await expect(running).toContainText('Adamant-Tiefbohrung (Stufe 5)');
  await expect(running.getByLabel('Fortschritt Gebäude')).toBeVisible();
  await expect(idle).toHaveCount(1);

  // „Wechseln“ makes the colony the shown place. It has no order either, so
  // its own card says nothing runs, and the home planet (building) is not idle.
  await idle.getByRole('button', { name: 'Wechseln' }).click();
  await expectShownPlace(page, 'Aussenposten');
  await expect(card(page, 'Läuft')).toContainText('Es läuft gerade nichts.');
  await expect(
    page.locator('section.cards li', { hasText: 'Bauschleife leer: ' }),
  ).toHaveCount(0);
  expect(w.problems).toEqual([]);
});

test('an incoming attack stands in „Achtung“ with its countdown @phone', async ({
  page,
  browser,
}) => {
  test.slow();
  const w = watch(page);
  const defender = uniqueName('Verteidiger');
  const attacker = uniqueName('Angreifer');
  await register(page, defender);
  // Mines give the defender points, so the attacker is no noob protected
  // against it (as in e2e/incoming-fleets.spec.ts).
  seed({ name: defender, b: { metal: 12, crystal: 10, solar: 12 } });
  const other = await browser.newPage();
  const wo = watch(other);
  await register(other, attacker);
  seed({
    name: attacker,
    ships: { lf: 5, sc: 2 },
    res: { m: 0, c: 0, d: 10000 },
  });
  await nav(other, 'highscore');
  await other
    .locator('tr')
    .filter({ has: other.getByRole('cell', { name: defender, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await (
    await galaxyAction(other, galaxyRow(other, defender), 'Sturmangriff')
  ).click();
  await other.getByLabel('Anzahl Abfangjäger').fill('5');
  await other.getByLabel('Anzahl Frachtläufer').fill('2');
  await other.getByRole('button', { name: 'Flotte losschicken' }).click();
  await expect(other.locator('.toast').last()).toContainText(
    'Flotte unterwegs nach',
  );
  await other.close();

  await page.reload();
  const attention = card(page, 'Achtung');
  const line = attention.locator('li', { hasText: 'Sturmangriff von ' });
  await expect(line).toContainText(attacker);
  await expect(line).toContainText(/\[\d+:\d+:\d+\]/);
  expect(w.problems).toEqual([]);
  expect(wo.problems).toEqual([]);
});
