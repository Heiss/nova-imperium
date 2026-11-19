// A battle (#68): the attacker wins, takes loot home, and both sides get a
// report.
import { expect, test } from '@playwright/test';
import {
  login,
  logout,
  nav,
  seed,
  stock,
  uniqueName,
  watch,
} from './helpers.ts';
import { attack, report } from './fleet-helpers.ts';

test.describe('fleet and battle (#68)', () => {
  test('an attack wins the battle, takes loot home and leaves reports for both sides', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Sturm');
    const b = uniqueName('Beute');
    await attack(page, a, b);
    const badge = page.locator('#menu [data-v=messages] .badge');
    await expect(badge).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.fl-back')).toContainText('kehrt von');
    await nav(page, 'messages');
    await expect(badge).toHaveCount(0);
    const battle = report(page, /^Kampfbericht .* – gewonnen/);
    await battle.locator('.t').click();
    await expect(battle).toContainText('1 Runde(n)');
    await expect(battle).toContainText(
      'Der Angreifer hat die Schlacht gewonnen!',
    );
    await expect(battle.locator('tr', { hasText: 'Spähschädel' })).toHaveText(
      /Spähschädel\s*1\s*0\s*1/,
    );
    // Holds of 5 × 50 + 2 × 5,000 = 10,250: a third Adamant, then half of the
    // rest Psikristall, the rest Promethium (plunder in arrival.ts).
    const loot = 'Adamant 3.416 · Psikristall 3.417 · Promethium 3.417';
    await expect(battle).toContainText(`Erbeutet: ${loot}`);

    seed({ name: a, returnFleet: true });
    const home = report(page, 'Rückkehr zu');
    await expect(home).toBeVisible({ timeout: 15000 });
    await home.locator('.t').click();
    await expect(home).toContainText(
      `Deine Flotte ist zurück und bringt ${loot} mit.`,
    );
    await expect(stock(page, 'Adamant')).toHaveText(/^3\.41\d$/);

    await logout(page);
    await login(page, b);
    await expect(badge).toBeVisible();
    await nav(page, 'messages');
    const hit = report(page, `Feindkontakt! Heimatplanet`);
    await hit.locator('.t').click();
    await expect(hit).toContainText(`angegriffen`);
    await expect(hit).toContainText(`Erbeutet: ${loot}`);
    expect(w.problems).toEqual([]);
  });
});
