// The admin event log filters by a planet or fleet of an event (#151).
import { expect, test } from '@playwright/test';
import { cli, nav, uniqueName, watch } from './helpers.ts';
import { attack } from './fleet-helpers.ts';

test.describe('admin (#68)', () => {
  test('the event log filters by a planet or fleet of an event (#151)', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Feldherr');
    const b = uniqueName('Ziel');
    await attack(page, a, b);
    await expect(page.locator('.fl-back')).toContainText('kehrt von', {
      timeout: 15000,
    });
    cli('admin', a);
    await page.reload();
    await nav(page, 'admin');
    const events = page.locator('[data-admin=events]');
    const count = events.getByRole('status');
    await page
      .getByLabel('Spieler', { exact: true })
      .selectOption({ label: a });
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    // Registration, the attack order, the battle and the admin's reads. The
    // list of the tab (all players) is on screen first and the answer of the
    // filter replaces it, with the reads of the admin on top: every row moves
    // down. A click on a row before that answer lands on whatever row the
    // answer puts there (the load-dependent failure of this test), so wait for
    // the first read of the admin, which only the answer of the filter holds.
    const row = (action: RegExp) => events.getByRole('row', { name: action });
    await expect(row(/admin\.read \/ events/)).toBeVisible();
    await expect(count).toHaveText(/ · ([3-9]|\d{2,}) Ereignisse$/);
    const battle = row(/system \/ battle/);
    // The opened details stay open over the redraws of the poll and over the
    // new page of the log (logic/admin-panels.svelte.ts; e2e/redraw-drafts.spec.ts).
    const details = battle.locator('details');
    await battle.getByText(/^Kampfdetails \d+$/).click();
    await expect(details).toHaveAttribute('open', '');
    await expect(battle.locator('details > code')).toContainText('"fleet"');
    const detail = JSON.parse(
      await battle.locator('details > code').innerText(),
    ) as { fleet: string; planet: string };
    await expect(
      events.getByRole('button', { name: /^Aufträge zu/ }),
    ).toHaveCount(0);

    // The fleet: its attack order and its battle, long after the order.
    await battle
      .getByRole('button', {
        name: `Ereignisse zu ${detail.fleet}`,
        exact: true,
      })
      .click();
    await expect(page.getByLabel('Planet / Flotte')).toHaveValue(detail.fleet);
    await expect(count).toHaveText('Seite 1 von 1 · 2 Ereignisse');
    await expect(battle).toBeVisible();
    await expect(row(/game \/ send/)).toBeVisible();
    await expect(row(/account \/ register/)).toHaveCount(0);

    // The attacked planet: the same two events of this attacker. The details
    // the admin opened stay open over the new page of the log.
    await expect(battle.locator('details')).toHaveAttribute('open', '');
    await battle
      .getByRole('button', {
        name: `Ereignisse zu ${detail.planet}`,
        exact: true,
      })
      .click();
    await expect(page.getByLabel('Planet / Flotte')).toHaveValue(detail.planet);
    await expect(count).toHaveText('Seite 1 von 1 · 2 Ereignisse');
    await expect(battle).toBeVisible();
    await expect(row(/game \/ send/)).toBeVisible();
    cli('unadmin', a);
    expect(w.problems).toEqual([]);
  });
});
