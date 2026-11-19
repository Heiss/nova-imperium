// Espionage: the probes per Auspex-Erkundung and noob protection (#68).
import { expect, test } from '@playwright/test';
import {
  galaxyRow,
  lastToast,
  logout,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';
import { openSystemOf, shipCount } from './fleet-helpers.ts';

test.describe('galaxy, shipyard and options (#68)', () => {
  test('„Spähschädel pro Auspex-Erkundung“ is saved and sent by the galaxy spy button', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Spaeher');
    const b = uniqueName('Nachbar');
    await register(page, b);
    await logout(page);
    await register(page, a);
    // Auspex-Lehre 1 lets the player spy (#175, Q1).
    seed({
      name: a,
      ships: { probe: 5 },
      research: { spy: 1 },
      res: { m: 0, c: 0, d: 10000 },
    });
    seed({ name: b, b: { metal: 10 } });
    await nav(page, 'help');
    const probes = page.getByLabel('Spähschädel pro Auspex-Erkundung');
    await expect(probes).toHaveValue('1');
    await probes.fill('3');
    await page.click('[data-act=saveopt]');
    await expect(lastToast(page)).toContainText('Gespeichert.');
    await page.reload();
    await expect(probes).toHaveValue('3');
    await openSystemOf(page, b);
    await expect(
      page.getByText('Auspex-Erkundung schickt 3 Spähschädel'),
    ).toBeVisible();
    await galaxyRow(page, b).getByText('Auspex-Erkundung').click();
    await expect(lastToast(page)).toContainText('Flotte unterwegs nach');
    await nav(page, 'fleet');
    await expect(page.locator('.fl-spy')).toContainText('3 Spähschädel');
    await expect(shipCount(page, 'Spähschädel')).toHaveText('2');
    expect(w.problems).toEqual([]);
  });
});

test.describe('fleet and battle (#68)', () => {
  test('noob protection (n) blocks spying on and attacking a much weaker player', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Riese');
    const b = uniqueName('Zwerg');
    await register(page, b);
    await logout(page);
    await register(page, a);
    // 22 points against the 0 of a new player: less than a fifth.
    seed({
      name: a,
      ships: { probe: 2, lf: 5 },
      res: { d: 10000, m: 0, c: 0 },
    });
    await openSystemOf(page, b);
    const row = galaxyRow(page, b);
    await expect(row.getByTitle('Noobschutz')).toHaveText('(n)');
    await row.getByText('Auspex-Erkundung').click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Dieser Spieler steht unter Noobschutz.',
    );
    await row.getByText('Sturmangriff').click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('attack');
    await page.getByLabel('Anzahl Abfangjäger').fill('1');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Dieser Spieler steht unter Noobschutz.',
    );
    await expect(page.locator('.box .hd').first()).toHaveText(
      'Flotten unterwegs (0 / 1 Slots)',
    );
    expect(w.problems).toEqual([]);
  });
});
