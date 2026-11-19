// The expeditions (#93, okf/features/expeditions.md): with
// Kreuzzugs-Kartografie the Sternenkarte shows the expedition position after
// the last planet position of every system with the button „Expedition“; the
// fleet form asks for the hours of the stay, refuses more than the level
// allows, and the fleet flies there. The event is a chance of the game (no
// hook fixes it), so the test checks what holds for every outcome: a report
// of the expedition with the words of its subject, and the fleet that flies
// home or is gone as the subject says.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { shipCount } from './fleet-helpers.ts';
import { nav, ownArea, register, seed, uniqueName, watch } from './helpers.ts';

const lastToast = (page: Page): Locator => page.locator('.toast').last();

/**
 * Every outcome of the draw (src/features/missions/expedition/arrive.server.ts):
 * the subject in the title of the report, the words of its body, and what is
 * left of the fleet: lost, all ships home again (safe), a battle won (some
 * ships home), or null when a battle ends in a draw (the fleet is gone only if
 * it lost every ship).
 */
const OUTCOMES: {
  title: RegExp;
  body: string | RegExp;
  home: 'lost' | 'safe' | 'won' | null;
}[] = [
  {
    title: / – nichts entdeckt/,
    body: 'Die Expedition hat nichts Besonderes gefunden und kehrt heim.',
    home: 'safe',
  },
  {
    title: / – Rohstofffund/,
    body: /Rohstofffund gemacht: [\d.]+ (Adamant|Psikristall|Promethium) kommen mit der Flotte heim\.|Laderäume sind zu klein/,
    home: 'safe',
  },
  {
    title: / – Schiffsfund/,
    body: /Schiffsfund gemacht, die Schiffe schließen sich der Flotte an: |keine gefunden, die sich der Flotte anschließen/,
    home: 'safe',
  },
  {
    title: / – Flotte verloren/,
    body: 'Von der Expedition kam nur noch ein abgerissener Funkspruch. Die Flotte ist verloren.',
    home: 'lost',
  },
  {
    title: / – Rückkehr früher/,
    body: 'Die Expedition hat einen kürzeren Weg gefunden und kehrt früher als geplant zurück.',
    home: 'safe',
  },
  {
    title: / – Rückkehr später/,
    body: 'Die Expedition hat sich verirrt und kehrt später als geplant zurück.',
    home: 'safe',
  },
  { title: /^Kampfbericht .* – gewonnen/, body: 'Runde(n)', home: 'won' },
  { title: /^Kampfbericht .* – verloren/, body: 'Runde(n)', home: 'lost' },
  { title: /^Kampfbericht .* – unentschieden/, body: 'Runde(n)', home: null },
];

async function homeSystem(page: Page): Promise<void> {
  await nav(page, 'galaxy');
  await page.getByText('zum Heimatsystem').click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

test.describe('the expedition (#93)', () => {
  test('offers the expedition position, takes the hours of the stay and sends the fleet', async ({
    page,
  }) => {
    // A long test: it flies and waits for the arrival (about 25 s).
    test.slow();
    const w = watch(page);
    const name = uniqueName('Entdecker');
    await register(page, name);
    seed({
      name,
      ships: { lc: 5 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    await page.reload();

    // Without the research the position is there, but offers no expedition.
    await homeSystem(page);
    const row = page.locator('table.gal tr', {
      hasText: 'Expeditionsposition',
    });
    await expect(row).toHaveCount(1);
    await expect(row.locator('td.n')).toHaveText('16');
    await expect(row.getByRole('button', { name: 'Expedition' })).toHaveCount(
      0,
    );

    seed({ name, research: { expo: 4 } });
    await page.reload();
    await homeSystem(page);
    await row.getByRole('button', { name: 'Expedition' }).click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('expedition');
    await expect(page.getByLabel('Position', { exact: true })).toHaveValue(
      '16',
    );
    await expect(page.locator('#t_info')).toHaveText('Expeditionsposition');
    await expect(page.getByLabel('Haltezeit in Stunden')).toBeVisible();
    await expect(page.getByText(/Expeditionen \(0 \/ 2\)/)).toBeVisible();

    // More hours than the level allows are refused with the most.
    await page.getByLabel('Anzahl Lastbarke').fill('2');
    await page.getByLabel('Haltezeit in Stunden').fill('9');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText(
      'Die Haltezeit beträgt höchstens 4 Stunden.',
    );

    // A stay of two hours: the fleet flies, and the form shows the stay in its times.
    await page.getByLabel('Haltezeit in Stunden').fill('2');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await nav(page, 'overview');
    await expect(page.locator('.fl-expedition')).toContainText('Expedition');
    await expect(page.locator('.fl-expedition')).toContainText('2 Lastbarke');

    // Another mission may not fly there.
    await page.goto('/?view=fleet');
    await page.getByLabel('Anzahl Lastbarke').fill('1');
    await page.getByLabel('Position', { exact: true }).fill('16');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#t_info')).toHaveText('nur für Expeditionen');
    await expect(page.getByLabel('Haltezeit in Stunden')).toBeHidden();

    // The stay ends and the event is drawn: what it is is a chance of the
    // game, so the test asserts what holds for every outcome, one report of
    // the expedition whose body and fleet fit its subject.
    seed({ name, landFleet: 'expedition' });
    await nav(page, 'messages');
    const { g, s } = ownArea();
    const at = `\\[${g}:${s}:16\\]`;
    const report = page.locator('.rep').filter({
      has: page.locator('.t', {
        hasText: new RegExp(`^(Expedition|Kampfbericht) ${at} – `),
      }),
    });
    await expect(report).toHaveCount(1, { timeout: 15000 });
    const title = (await report.locator('.t').textContent())!;
    await report.locator('.t').click();
    const outcome = OUTCOMES.find((o) => o.title.test(title));
    expect(outcome, `the title of the report: ${title}`).toBeDefined();
    await expect(report).toContainText(outcome!.body);
    // The fleet: lost for good, or home again (the flight home is short, so
    // it is brought home now and its Lastbarken counted: 3 stayed, 2 flew; a
    // battle won leaves at least one of the two).
    if (outcome!.home !== null) {
      seed({ name, returnFleet: true });
      await nav(page, 'fleet');
      const barks = shipCount(page, 'Lastbarke');
      if (outcome!.home === 'lost') await expect(barks).toHaveText('3');
      else
        await expect
          .poll(async () => Number((await barks.innerText()).replace('.', '')))
          .toBeGreaterThanOrEqual(outcome!.home === 'won' ? 4 : 5);
    }
    expect(w.problems).toEqual([]);
  });
});
