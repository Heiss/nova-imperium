// The admin: inspecting a player with the audit of the data access, the
// admin panel, and copying an invitation link.
import { expect, test } from '@playwright/test';
import { E2E_UNIVERSE } from './env.ts';
import {
  cli,
  emailOf,
  lastToast,
  nav,
  ownArea,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('admin', () => {
  test('an admin can inspect a player and audit the data access', async ({
    page,
    browser,
  }) => {
    const name = uniqueName('Audit');
    const pilot = uniqueName('Pilot');
    const other = await browser.newPage();
    await register(other, pilot);
    await nav(other, 'buildings');
    await other.click('[data-act=build][data-k=metal]');
    await expect(other.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await expect(
      page.getByRole('button', { name: 'Erste Seite' }),
    ).toBeDisabled();
    await expect(page.getByLabel('Pro Seite')).toHaveValue('10');
    await page.getByRole('tab', { name: 'Spieler', exact: true }).click();
    await page
      .locator('[data-admin=stats]')
      .getByRole('button', { name: pilot, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: `Spielerakte · ${pilot}` }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Ereignisse zu diesem Spieler' })
      .click();
    await expect(
      page.getByRole('row', { name: /game \/ build/ }),
    ).toContainText(pilot);
    await page.getByLabel('Spieler', { exact: true }).selectOption('');
    await page.getByLabel('Aktion', { exact: true }).fill('player');
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    // The audit log is shared: other tests have read player records too, so
    // the row is the one of this test's admin.
    const audit = page
      .getByRole('row', { name: /admin.read \/ player/ })
      .filter({ hasText: name });
    await expect(audit).toContainText(pilot);
    await other.close();
  });

  test('only an admin made by the operator sees the admin panel', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Chef');
    await register(page, name);
    await expect(page.locator('#menu [data-v=admin]')).toHaveCount(0);
    expect(cli('admin', name)).toContain(`${name} is now admin.`);
    await page.reload();
    await nav(page, 'admin');
    await expect(page.locator('h2')).toHaveText('Admin');

    // An address of this test's own: invitations are shared by all tests.
    const friend = emailOf(uniqueName('Freund'));
    await page.getByRole('tab', { name: 'Einladungen' }).click();
    // Invitation without SMTP: the link is shown for copying.
    await page.fill('#inv_email', friend);
    await page.click('#inviteform button[type=submit]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Kein SMTP eingerichtet',
    );
    await expect(page.locator('#inv_link')).toHaveValue(/#invite=[\w-]{43}$/);
    await expect(page.locator('#admin-invitations table.mini')).toContainText(
      friend,
    );
    await page
      .locator('tr', { hasText: friend })
      .locator('[data-act=revoke]')
      .click();
    await expect(page.locator('tr', { hasText: friend })).toHaveCount(0);

    await page.getByRole('tab', { name: 'Universum' }).click();
    // Settings: live, but the universe never shrinks below a planet. The
    // planet comes from this test, not from an earlier one: it lies in the
    // galaxy of the area of this test. The message names the largest galaxy
    // any planet of the run lies in, which is this one or a larger one.
    const { g } = ownArea();
    seed({ name, colony: { name: 'Außenposten' } });
    await page.fill('#set_speed', '7');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x7',
    );
    await page.fill('#set_galaxies', '1');
    await page.click('[data-act=saveSettings]');
    const refused = page.locator('.toast.err').last();
    await expect(refused).toContainText(/Galaxien: mindestens \d+/);
    const [, least] = /Galaxien: mindestens (\d+)/.exec(
      (await refused.textContent())!,
    )!;
    expect(Number(least)).toBeGreaterThanOrEqual(g);
    await page.fill('#set_galaxies', String(E2E_UNIVERSE.galaxies));
    await page.fill('#set_speed', '5');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x5',
    );
    expect(cli('unadmin', name)).toContain('no longer admin');
    expect(w.problems).toEqual([]);
  });
});

test.describe('admin (#68)', () => {
  test('the admin copies an invitation link', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const w = watch(page);
    const name = uniqueName('Kopierer');
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Einladungen' }).click();
    const email = `einladung-${name.toLowerCase()}@example.org`;
    await page.fill('#inv_email', email);
    await page.click('#inviteform button[type=submit]');
    const link = page.getByLabel('Einladungslink');
    await expect(link).toHaveValue(/#invite=[\w-]{43}$/);
    await page.getByRole('button', { name: 'Kopieren' }).click();
    await expect(lastToast(page)).toHaveText('Link kopiert.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      await link.inputValue(),
    );
    const row = page.locator('tr', { hasText: email });
    await row.getByRole('button', { name: 'Widerrufen' }).click();
    await expect(row).toHaveCount(0);
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });
});
