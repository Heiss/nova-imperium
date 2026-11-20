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
    // Registration, the attack order, the battle and the admin's reads.
    await expect(count).toHaveText(/ · ([3-9]|\d{2,}) Ereignisse$/);
    const row = (action: RegExp) => events.getByRole('row', { name: action });
    const battle = row(/system \/ battle/);
    // The log is drawn anew by the poll of the state and by the answer of the
    // filter; the details the admin opened stay open (logic/admin-panels.svelte.ts).
    // Open them only while they are closed, so a redraw between the read of the
    // state and the click cannot close them again, and wait for the code.
    const details = battle.locator('details');
    await expect(async () => {
      if ((await details.getAttribute('open')) === null)
        await battle.getByText(/^Kampfdetails \d+$/).click();
      await expect(details).toHaveAttribute('open', '', { timeout: 1000 });
      await expect(battle.locator('details > code')).toContainText('"fleet"', {
        timeout: 1000,
      });
    }).toPass({ timeout: 15000 });
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
