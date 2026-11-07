import { expect, test } from '@playwright/test';
import {
  cli,
  inviteLink,
  login,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('accounts', () => {
  test('nobody registers without an invitation', async ({ page }) => {
    const w = watch(page);
    await page.goto('/');
    await expect(page.locator('.auth .hd')).toHaveText('Login');
    await expect(page.locator('#a_email')).toHaveCount(0);
    await expect(
      page.getByText('Ein Konto bekommst du nur mit einer Einladung'),
    ).toBeVisible();
    await page.goto('/#invite=forged-token');
    await expect(page.locator('.toast.err')).toContainText('ungültig');
    await expect(page.locator('#a_email')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });

  test('an invitation registers once; the token leaves the address bar', async ({
    page,
    browser,
  }) => {
    const w = watch(page);
    const name = uniqueName('Neu');
    const link = inviteLink(`${name.toLowerCase()}@example.org`);
    await page.goto(link);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('#a_email')).toHaveAttribute('readonly', '');
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'geheim123');
    await page.selectOption('#a_gal', '2');
    await page.click('button[type=submit]');
    await expect(page.locator('.toast')).toContainText(`Willkommen, ${name}!`);
    await expect(page.locator('#pinfo')).toContainText('[2:');
    const other = await browser.newPage();
    await other.goto(link);
    await expect(other.locator('.toast.err')).toContainText('schon benutzt');
    await other.close();
    expect(w.problems).toEqual([]);
  });

  test('log out and in again; a wrong password is refused', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Login');
    await register(page, name);
    await page.click('[data-act=logout]');
    await expect(page.locator('.auth .hd')).toHaveText('Login');
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'falsch!!');
    await page.click('button[type=submit]');
    await expect(page.locator('.toast.err')).toHaveText(
      'Name oder Passwort falsch.',
    );
    await login(page, name);
    expect(w.problems).toEqual([]);
  });
});

test.describe('playing', () => {
  test('every page renders without CSP violations or script errors', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Tour'));
    for (const view of [
      'buildings',
      'resources',
      'research',
      'shipyard',
      'defense',
      'fleet',
      'galaxy',
      'messages',
      'highscore',
      'help',
      'overview',
    ]) {
      await nav(page, view);
      await expect(page.locator('#menu a.on')).toHaveAttribute('data-v', view);
    }
    await expect(page.locator('.planet')).toHaveCSS(
      'background-image',
      /radial-gradient/,
    );
    expect(w.problems).toEqual([]);
  });

  test('the URL restores the view on reload and browser navigation', async ({
    page,
  }) => {
    await register(page, uniqueName('Nav'));
    const selected = page.locator('#menu a.on');
    await nav(page, 'buildings');
    await expect(page).toHaveURL(/\?view=buildings$/);
    await page.reload();
    await expect(selected).toHaveAttribute('data-v', 'buildings');
    await nav(page, 'research');
    await page.goBack();
    await expect(selected).toHaveAttribute('data-v', 'buildings');
    await page.goForward();
    await expect(selected).toHaveAttribute('data-v', 'research');
  });

  test('an expired build restores the buttons and leaves a view notice', async ({
    page,
  }) => {
    await page.clock.install();
    await register(page, uniqueName('Fertig'));
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=metal]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();

    // Keep state refreshes pending to verify the UI updates before a reply.
    await page.route('**/api/state', () => {});
    const deadline = Number(
      await page.locator('#view .cd').getAttribute('data-end'),
    );
    await page.clock.fastForward(
      deadline - (await page.evaluate(() => Date.now())) + 3000,
    );
    await expect(page.locator('[data-act=build][data-k=metal]')).toBeEnabled();
    await expect(page.locator('[data-act=cancelBuild]')).toHaveCount(0);
    const notice = page
      .getByRole('status')
      .filter({ hasText: 'Ausbau fertig' });
    await expect(notice).toBeVisible();
    await nav(page, 'overview');
    await nav(page, 'buildings');
    await expect(notice).toHaveCount(0);
  });

  test('build, cancel, set production and rename', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Bau'));
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=metal]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await expect(page.locator('#resbar')).toContainText('440');
    await page.click('[data-act=cancelBuild]');
    await expect(page.locator('[data-act=build][data-k=metal]')).toBeEnabled();
    await expect(page.locator('#resbar')).toContainText('500');
    await nav(page, 'resources');
    await page.selectOption('select[data-k=metal]', '50');
    await expect(page.locator('select[data-k=metal]')).toHaveValue('50');
    await nav(page, 'overview');
    await page.click('[data-act=rename]');
    await page.fill('#rn', 'Neu<b>Welt');
    await page.click('[data-act=doRename]');
    await expect(page.locator('h2')).toContainText('Neu<b>Welt');
    expect(w.problems).toEqual([]);
  });

  test('ships are ordered, a fleet flies, spies and comes home', async ({
    page,
  }) => {
    const w = watch(page);
    const a = uniqueName('Flotte');
    const b = uniqueName('Ziel');
    await register(page, b);
    await page.click('[data-act=logout]');
    await register(page, a);
    seed({
      name: a,
      b: { yard: 3, robot: 2, metal: 10 },
      research: { comb: 3, spy: 2 },
      ships: { probe: 2, sc: 3 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    seed({ name: b, b: { metal: 12 } });
    await page.reload();
    await nav(page, 'shipyard');
    await page.fill('#q_lf', '2');
    await page.click('[data-act=order][data-k=lf]');
    await expect(page.locator('.toast').last()).toContainText(
      '2× Leichter Jäger in Auftrag gegeben.',
    );
    await nav(page, 'fleet');
    await page.fill('#f_sc', '1');
    await expect(page.locator('#i_cap')).toContainText('5.000');
    await page.click('[data-act=send]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'dein eigener Planet',
    );
    await nav(page, 'highscore');
    const target = page.locator('tr', { hasText: b }).locator('[data-act=gto]');
    await target.click();
    await expect(page.locator('h2')).toHaveText('Galaxie');
    await page.locator('tr', { hasText: b }).locator('[data-act=gspy]').click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await nav(page, 'overview');
    await expect(page.locator('.fl-spy')).toContainText('Spionage');
    await expect(page.locator('#menu .badge')).toBeVisible({ timeout: 30000 });
    await nav(page, 'messages');
    await page
      .locator('.rep .t', { hasText: 'Spionagebericht' })
      .first()
      .click();
    await expect(page.locator('.rep.open')).toContainText('Rohstoffe auf');
    expect(w.problems).toEqual([]);
  });

  test('the layout works on a phone @phone', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Handy'));
    await nav(page, 'buildings');
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(width).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});

test.describe('admin', () => {
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

    // Invitation without SMTP: the link is shown for copying.
    await page.fill('#inv_email', 'freund@example.org');
    await page.click('#inviteform button[type=submit]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Kein SMTP eingerichtet',
    );
    await expect(page.locator('#inv_link')).toHaveValue(/#invite=[\w-]{43}$/);
    await expect(page.locator('table.mini')).toContainText(
      'freund@example.org',
    );
    await page
      .locator('tr', { hasText: 'freund@example.org' })
      .locator('[data-act=revoke]')
      .click();
    await expect(
      page.locator('tr', { hasText: 'freund@example.org' }),
    ).toHaveCount(0);

    // Settings: live, but the universe never shrinks below a planet.
    await page.fill('#set_speed', '7');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x7',
    );
    await page.fill('#set_galaxies', '1');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Galaxien: mindestens 2',
    );
    await page.fill('#set_galaxies', '2');
    await page.fill('#set_speed', '5');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x5',
    );
    expect(cli('unadmin', name)).toContain('no longer admin');
    expect(w.problems).toEqual([]);
  });
});
