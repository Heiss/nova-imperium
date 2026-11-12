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

test('login stays near the header @phone', async ({ page }) => {
  await page.goto('/');
  const login = page.locator('.auth');
  await expect(
    login.getByRole('button', { name: 'Einloggen' }),
  ).toBeInViewport();
  const header = (await page.locator('header').boundingBox())!;
  const form = (await login.boundingBox())!;
  expect(form.y - (header.y + header.height)).toBeLessThan(100);
});

test('offers home-screen installation on a phone @phone', async ({ page }) => {
  await page.goto('/');
  const offer = page.locator('#pwa-offer');
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'App installieren' }).click();
  await expect(
    page.getByText('Zum Spielen brauchst du eine Internetverbindung.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Schließen' }).click();
  await offer.getByRole('button', { name: 'Später' }).click();
  await expect(offer).toBeHidden();
  await page.reload();
  await expect(page.locator('.auth')).toBeVisible();
  await expect(offer).toBeHidden();
});

test('displays an announcement received by the online-only push worker', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['notifications']);
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  const registrationId = new Promise<string>((resolve) => {
    cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
      const current = registrations.find((item) => !item.isDeleted);
      if (current) resolve(current.registrationId);
    });
  });
  await cdp.send('ServiceWorker.enable');
  const registration = context.waitForEvent('serviceworker');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/push-worker.js');
    await navigator.serviceWorker.ready;
  });
  const worker = await registration;
  await worker.evaluate(() => {
    const scope = globalThis as unknown as {
      registration: ServiceWorkerRegistration;
      testNotification?: { title: string; body?: string; data: unknown };
    };
    scope.registration.showNotification = async (title, options) => {
      scope.testNotification = {
        title,
        body: options?.body,
        data: options?.data,
      };
    };
  });
  const text = 'Servernachricht: Wartung';
  await cdp.send('ServiceWorker.deliverPushMessage', {
    origin: new URL(page.url()).origin,
    registrationId: await registrationId,
    data: JSON.stringify({
      title: text,
      view: 'messages',
      tag: 'announcement-test',
    }),
  });
  await expect
    .poll(() =>
      worker.evaluate(() => Reflect.get(globalThis, 'testNotification')),
    )
    .toEqual({ title: 'Nova Imperium', body: text, data: 'messages' });
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

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
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
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

  test('registers, uses and removes a passkey', async ({ page, context }) => {
    const session = await context.newCDPSession(page);
    await session.send('WebAuthn.enable');
    await session.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    const name = uniqueName('Passkey');
    await register(page, name);
    await nav(page, 'help');
    await page
      .getByLabel('Passwort für neuen Passkey')
      .fill('ein-sicheres-testpasswort');
    await page.getByRole('button', { name: 'Passkey hinzufügen' }).click();
    await expect(
      page.getByText('Passkey gespeichert.', { exact: true }),
    ).toBeVisible();
    await page.click('[data-act=logout]');
    await page
      .getByRole('checkbox', { name: 'Login auf diesem Gerät speichern' })
      .check();
    await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
    await expect(page.locator('#pinfo')).toContainText(name);
    expect(
      (await context.cookies()).find((cookie) => cookie.name === 'nova_session')
        ?.expires,
    ).toBeGreaterThan(0);
    await nav(page, 'help');
    await page
      .getByRole('button', { name: 'Gespeicherte Passkeys anzeigen' })
      .click();
    page.once('dialog', (dialog) => void dialog.accept());
    await page.getByRole('button', { name: 'Entfernen', exact: true }).click();
    await expect(page.getByText('Keine Passkeys gespeichert.')).toBeVisible();
  });

  test('deletes the account only after password confirmation', async ({
    page,
  }) => {
    await register(page, uniqueName('Loeschen'));
    await nav(page, 'help');
    await page
      .getByRole('button', { name: 'Account löschen', exact: true })
      .click();
    await page.getByLabel('Passwort zur Bestätigung').fill('falsch');
    await page
      .getByRole('button', { name: 'Account endgültig löschen' })
      .click();
    await expect(page.getByRole('alert')).toContainText('Passwort ist falsch');
    await page
      .getByLabel('Passwort zur Bestätigung')
      .fill('ein-sicheres-testpasswort');
    await page
      .getByRole('button', { name: 'Account endgültig löschen' })
      .click();
    await expect(page.getByText('Dein Account wurde gelöscht.')).toBeVisible();
    await expect(page.locator('.auth .hd')).toHaveText('Login');
  });

  test('changes a password from the account options', async ({ page }) => {
    const name = uniqueName('Passwort');
    await register(page, name);
    await nav(page, 'help');
    const form = page.locator('#passwordform');
    await form
      .getByLabel('Bisheriges Passwort')
      .fill('ein-sicheres-testpasswort');
    await form
      .getByLabel('Neues Passwort', { exact: true })
      .fill('ein-neues-testpasswort');
    await form
      .getByLabel('Neues Passwort wiederholen')
      .fill('ein-falsches-testpasswort');
    await form.getByRole('button', { name: 'Passwort ändern' }).click();
    await expect(page.getByRole('alert')).toContainText(
      'stimmen nicht überein',
    );
    await form
      .getByLabel('Neues Passwort wiederholen')
      .fill('ein-neues-testpasswort');
    await form.getByRole('button', { name: 'Passwort ändern' }).click();
    await expect(page.locator('.auth .hd')).toHaveText('Login');
    await login(page, name, 'ein-neues-testpasswort');
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

test('creates a guild and restores its profile after reload', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Gruender');
  await register(page, name);
  await nav(page, 'guilds');
  await page.getByLabel('Kürzel').fill('NOVA');
  await page.getByLabel('Name', { exact: true }).fill('Nova Allianz');
  await page.getByLabel('Gildentext (Markdown)').fill('**Gemeinsam ins All**');
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page).toHaveURL(/view=guilds&guild=/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '[NOVA] Nova Allianz' }),
  ).toBeVisible();
  await expect(
    page.locator('strong', { hasText: 'Gemeinsam ins All' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  expect(w.problems).toEqual([]);
});

test('filters achievements and keeps tomorrow’s reward after claiming', async ({
  page,
}) => {
  await register(page, uniqueName('Erfolg'));
  const badge = page.locator('#menu [data-v=achievements] .badge');
  await expect(badge).toHaveAttribute('aria-label', 'Tagesbelohnung abholbar');
  await nav(page, 'achievements');
  const next = page.getByText('Morgen bei fortgesetzter Serie:', {
    exact: false,
  });
  await expect(next).toBeVisible();
  const reward = await next.textContent();
  await page.getByRole('button', { name: 'Tagesbelohnung abholen' }).click();
  await expect(page.getByText('Abgeholt', { exact: true })).toBeVisible();
  await expect(next).toHaveText(reward!);
  await expect(badge).toHaveCount(0);
  await page.getByLabel('Kategorie', { exact: true }).selectOption('buildings');
  await page.getByLabel('Suchen', { exact: true }).fill('Metallmine');
  const visible = page.locator('[data-achievement]:visible');
  await expect(visible.first()).toContainText('Metallmine');
  await expect(
    page.locator('[data-achievement]:visible:not([data-category=buildings])'),
  ).toHaveCount(0);
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
      'news',
      'help',
      'overview',
    ]) {
      await nav(page, view);
      await expect(page.locator('#menu a.on')).toHaveAttribute('data-v', view);
    }
    await expect(page.locator('.pl .pl-surface')).toHaveCSS(
      'background-image',
      /\/planets\/[a-z]+-[0-2]-surface\.svg/,
    );
    await expect(page.locator('.kv')).toContainText('Planetentyp');
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
    const badge = page.locator('#menu [data-v=buildings] .badge');
    await expect(badge).toHaveAttribute('aria-label', 'Ausbau fertig');
    await expect(notice).toBeVisible();
    await nav(page, 'overview');
    await nav(page, 'buildings');
    await expect(page.locator('#menu [data-v=buildings] .badge')).toHaveCount(
      0,
    );
    await expect(notice).toHaveCount(0);
  });

  test('resource production enables an unaffordable build in place', async ({
    page,
  }) => {
    await page.clock.install();
    const name = uniqueName('Rohstoff');
    await register(page, name);
    seed({ name, res: { m: 59, c: 500, d: 0 } });
    await page.goto('/?view=buildings');
    const build = page.locator('[data-act=build][data-k=metal]');
    await expect(build).toBeDisabled();
    await build.evaluate((button) =>
      button.setAttribute('data-same-button', ''),
    );
    await page.route('**/api/state', () => {});
    await page.clock.fastForward(5 * 60 * 1000);
    await expect(build).toBeEnabled();
    await expect(build).toHaveAttribute('data-same-button', '');
    await expect(page).toHaveURL(/\?view=buildings$/);
  });

  test('retries a build once when SQLite is busy', async ({ page }) => {
    await register(page, uniqueName('Retry'));
    await nav(page, 'buildings');
    let attempts = 0;
    await page.route('**/api/action', async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.fulfill({ status: 503, json: { code: 'ACTION_DB_BUSY' } });
      } else {
        await route.continue();
      }
    });
    await page.click('[data-act=build][data-k=metal]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await expect(page.locator('#resbar')).toContainText('440');
    expect(attempts).toBe(2);
  });

  test('lists all missing requirements and starts the next one (#64)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Plan');
    await register(page, name);
    seed({ name, res: { m: 5000, c: 5000, d: 5000 } });
    await page.goto('/?view=buildings');
    const yard = page.locator('.item').filter({ hasText: 'Raumschiffwerft' });
    const robot = yard.locator('.need').filter({ hasText: 'Roboterfabrik' });
    await expect(robot).toContainText('Stufe 2 (aktuell 0)');
    await expect(robot).toHaveClass(/ready/);
    await robot.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(page.locator('.item.running')).toContainText('Roboterfabrik');
    await expect(page).toHaveURL(/\?view=buildings$/);
    await expect(robot).toContainText('Bauschleife belegt');
    await expect(
      robot.getByRole('button', { name: 'Jetzt bauen' }),
    ).toBeDisabled();
    expect(w.problems).toEqual([]);
  });

  test('starts a research requirement of a ship, indirect ones included (#64)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Jaeger');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 1, lab: 1 },
      res: { m: 50000, c: 50000, d: 50000 },
    });
    await page.goto('/?view=shipyard');
    const fighter = page.locator('.item').filter({ hasText: 'Leichter Jäger' });
    const comb = fighter.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Verbrennungstriebwerk$/ }),
    });
    const energy = fighter.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Energietechnik$/ }),
    });
    await expect(comb).toHaveClass(/missing/);
    await expect(comb).toContainText('braucht Energietechnik (Stufe 1)');
    await expect(energy).toContainText('für Verbrennungstriebwerk');
    await energy.getByRole('button', { name: 'Jetzt forschen' }).click();
    await expect(energy).toContainText('Es wird bereits geforscht');
    await expect(
      energy.getByRole('button', { name: 'Jetzt forschen' }),
    ).toBeDisabled();
    await expect(page).toHaveURL(/\?view=shipyard$/);
    expect(w.problems).toEqual([]);
  });

  test('research view: start a missing research, lab upgrade blocks it (#64)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Labor');
    await register(page, name);
    seed({
      name,
      b: { lab: 1 },
      research: { energy: 1 },
      res: { m: 50000, c: 50000, d: 50000 },
    });
    await page.goto('/?view=buildings');
    await page.click('[data-act=build][data-k=lab]');
    await nav(page, 'research');
    const laser = page
      .locator('.item')
      .filter({ has: page.locator('.nm', { hasText: /^\s*Lasertechnik/ }) });
    const energy = laser.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Energietechnik$/ }),
    });
    await expect(energy).toContainText('Stufe 2 (aktuell 1)');
    await expect(energy).toContainText('Labor wird ausgebaut');
    await expect(
      energy.getByRole('button', { name: 'Jetzt forschen' }),
    ).toBeDisabled();
    await nav(page, 'buildings');
    await page.click('[data-act=cancelBuild]');
    await nav(page, 'research');
    await energy.getByRole('button', { name: 'Jetzt forschen' }).click();
    await expect(energy).toContainText('Es wird bereits geforscht');
    await expect(page).toHaveURL(/\?view=research$/);
    expect(w.problems).toEqual([]);
  });

  test('from a colony the lab is built on the home planet (#64)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Siedler');
    await register(page, name);
    seed({
      name,
      res: { m: 50000, c: 50000, d: 50000 },
      colony: {
        b: { robot: 2, yard: 1 },
        res: { m: 50000, c: 50000, d: 50000 },
      },
    });
    await page.reload();
    const selector = page.getByLabel('Aktiver Planet');
    const colony = selector
      .locator('option')
      .filter({ hasText: /^Kolonie \[/ });
    await selector.selectOption((await colony.getAttribute('value'))!);
    await expect(page.locator('#pinfo b').first()).toHaveText('Kolonie');
    await nav(page, 'shipyard');
    const fighter = page
      .locator('.item')
      .filter({ has: page.locator('.nm', { hasText: /^\s*Leichter Jäger/ }) });
    const lab = fighter.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Forschungslabor$/ }),
    });
    await expect(lab).toContainText('auf dem Heimatplaneten');
    await expect(lab).toHaveClass(/ready/);
    await lab.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(lab).toContainText('Bauschleife belegt');
    await expect(page.locator('#pinfo b').first()).toHaveText('Kolonie');
    await expect(page).toHaveURL(/\?view=shipyard$/);
    const home = selector
      .locator('option')
      .filter({ hasText: /^Heimatplanet \[/ });
    await selector.selectOption((await home.getAttribute('value'))!);
    await nav(page, 'buildings');
    await expect(page.locator('.item.running')).toContainText(
      'Forschungslabor',
    );
    expect(w.problems).toEqual([]);
  });

  test('a requirement two levels away is built level by level (#64, D3)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Stufen');
    await register(page, name);
    seed({ name, res: { m: 50000, c: 50000, d: 50000 } });
    await page.goto('/?view=buildings');
    const yard = page
      .locator('.item')
      .filter({ has: page.locator('.nm', { hasText: /^\s*Raumschiffwerft/ }) });
    const robot = yard.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Roboterfabrik$/ }),
    });
    await robot.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(page.locator('.item.running')).toContainText(
      'Ausbau auf Stufe 1',
    );
    seed({ name, b: { robot: 1 }, clearQueue: true });
    await page.reload();
    await expect(robot).toContainText('Stufe 2 (aktuell 1)');
    await robot.getByRole('button', { name: 'Jetzt bauen' }).click();
    await expect(page.locator('.item.running')).toContainText(
      'Ausbau auf Stufe 2',
    );
    seed({ name, b: { robot: 2 }, clearQueue: true });
    await page.reload();
    await expect(yard.locator('.needs')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });

  test('the Nanitenfabrik halves build times and stops the shipyard (#48)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Nanit');
    await register(page, name);
    const b = { robot: 10, yard: 2, lab: 1 };
    seed({
      name,
      b,
      research: { computer: 10 },
      res: { m: 5e6, c: 5e6, d: 5e6 },
    });
    const seconds = (text: string): number =>
      [...text.matchAll(/(\d+)([Thms])/g)].reduce(
        (sum, [, n, unit]) =>
          sum + Number(n) * { T: 86400, h: 3600, m: 60, s: 1 }[unit!]!,
        0,
      );
    const item = (nm: RegExp) =>
      page
        .locator('.item')
        .filter({ has: page.locator('.nm', { hasText: nm }) });
    const time = async (nm: RegExp, label: string): Promise<number> =>
      seconds(
        (await item(nm)
          .locator('.dim', { hasText: label })
          .first()
          .textContent())!,
      );
    const times = async () => {
      await page.goto('/?view=buildings');
      const building = await time(/^\s*Metallmine/, 'Bauzeit');
      await page.goto('/?view=shipyard');
      const ship = await time(/^\s*Leichter Jäger/, 'Bauzeit');
      await page.goto('/?view=research');
      const research = await time(/^\s*Energietechnik/, 'Forschungszeit');
      return { building, ship, research };
    };
    const before = await times();
    seed({ name, b: { ...b, nanite: 1 } });
    const after = await times();
    expect(Math.abs(after.building * 2 - before.building)).toBeLessThanOrEqual(
      1,
    );
    expect(Math.abs(after.ship * 2 - before.ship)).toBeLessThanOrEqual(1);
    expect(after.research).toBe(before.research);

    await page.goto('/?view=buildings');
    await expect(
      item(/^\s*Nanitenfabrik/).getByRole('img', { name: 'Nanitenfabrik' }),
    ).toHaveAttribute('src', '/icons/buildings/nanite_factory.svg');
    await page.click('[data-act=build][data-k=nanite]');
    await expect(page.locator('.item.running')).toContainText('Nanitenfabrik');
    await page.goto('/?view=shipyard');
    await expect(page.locator('.notice.warn')).toHaveText(
      'Die Nanitenfabrik wird gerade ausgebaut, die Werft kann nicht produzieren.',
    );
    // The Raketenwerfer needs only the shipyard, so it shows an order button.
    await page.goto('/?view=defense');
    await expect(page.locator('.notice.warn')).toContainText('Nanitenfabrik');
    await expect(page.locator('[data-act=order][data-k=rl]')).toBeDisabled();
    expect(w.problems).toEqual([]);
  });

  test('build, cancel, set production and rename', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Bau'));
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=metal]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await expect(page.locator('.item.running')).toHaveCount(1);
    await expect(page.getByLabel('Fortschritt Ausbau')).toBeVisible();
    await expect(page.locator('#resbar')).toContainText('440');
    await page.click('[data-act=cancelBuild]');
    await expect(page.locator('.item.running')).toHaveCount(0);
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

  test('builds solar and switches to a newly founded colony', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Kolonie');
    await register(page, name);
    seed({
      name,
      b: { robot: 10, yard: 4 },
      ships: { colony: 1 },
      research: { impulse: 3 },
      res: { m: 100000, c: 100000, d: 100000 },
    });
    await page.reload();
    await nav(page, 'buildings');
    await page.click('[data-act=build][data-k=solar]');
    await expect(page.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await nav(page, 'galaxy');
    await page.getByText('zum Heimatsystem').click();
    await page.getByRole('button', { name: 'Kolonisieren' }).first().click();
    await expect(page.getByLabel('Auftrag')).toHaveValue('colonize');
    await page.getByLabel('Anzahl Kolonialschiff').fill('1');
    await page.locator('#c_m').fill('400');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    seed({ name, landColonyFleet: true });
    const selector = page.getByLabel('Aktiver Planet');
    const colony = selector
      .locator('option')
      .filter({ hasText: /^Kolonie \[/ });
    await expect(colony).toHaveCount(1);
    await selector.selectOption((await colony.getAttribute('value'))!);
    await expect(page.locator('#pinfo b').first()).toHaveText('Kolonie');
    await nav(page, 'overview');
    await expect(page.locator('h2')).toContainText('Kolonie');
    await page.click('[data-act=rename]');
    await page.fill('#rn', 'Neue Welt');
    await page.click('[data-act=doRename]');
    await expect(page.locator('h2')).toContainText('Neue Welt');
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
    await expect(page.locator('#menu [data-v=messages] .badge')).toBeVisible({
      timeout: 30000,
    });
    await nav(page, 'messages');
    await page
      .locator('.rep .t', { hasText: 'Spionagebericht' })
      .first()
      .click();
    await expect(page.locator('.rep.open')).toContainText('Rohstoffe auf');
    expect(w.problems).toEqual([]);
  });

  test('Schlachtkreuzer and Zerstörer are built and fly (#58, #59)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Kreuzer');
    await register(page, name);
    seed({
      name,
      b: { robot: 2, yard: 9, lab: 7 },
      research: { energy: 5, shield: 5, laser: 12, hyper: 5, hdrive: 6 },
      ships: { bc: 2, dr: 1 },
      res: { m: 200000, c: 200000, d: 100000 },
      colony: {},
    });
    await page.goto('/?view=shipyard');
    const item = (nm: string) =>
      page.locator('.item').filter({
        has: page.locator('.nm', { hasText: new RegExp(`^\\s*${nm}`) }),
      });
    const bc = item('Schlachtkreuzer');
    const dr = item('Zerstörer');
    await expect(
      bc.getByRole('img', { name: 'Schlachtkreuzer' }),
    ).toHaveAttribute('src', '/icons/ships/battlecruiser.svg');
    await expect(dr.getByRole('img', { name: 'Zerstörer' })).toHaveAttribute(
      'src',
      '/icons/ships/destroyer.svg',
    );
    await expect(bc).toContainText(
      'Angriff 700 · Schild 600 · Struktur 70.000 · Ladung 750 · Tempo 28.000',
    );
    await expect(dr).toContainText(
      'Angriff 2.000 · Schild 750 · Struktur 110.000 · Ladung 2.000 · Tempo 14.000',
    );
    await expect(bc.locator('.needs')).toHaveCount(0);
    await expect(dr.locator('.needs')).toHaveCount(0);
    await page.fill('#q_bc', '1');
    await page.click('[data-act=order][data-k=bc]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Schlachtkreuzer in Auftrag gegeben.',
    );
    await page.fill('#q_dr', '1');
    await page.click('[data-act=order][data-k=dr]');
    await expect(page.locator('.toast').last()).toContainText(
      '1× Zerstörer in Auftrag gegeben.',
    );

    await nav(page, 'fleet');
    await page.getByLabel('Anzahl Schlachtkreuzer').fill('2');
    await page.getByLabel('Anzahl Zerstörer').fill('1');
    await page.getByLabel('Position', { exact: true }).fill('15');
    await page.getByLabel('Auftrag').selectOption('transport');
    await expect(page.locator('#i_cap')).toContainText('3.500');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs',
    );
    await expect(page.locator('.fl-transport')).toContainText(
      '2 Schlachtkreuzer, 1 Zerstörer',
    );
    expect(w.problems).toEqual([]);
  });

  test('the shipyard shows Schlachtkreuzer and Zerstörer on a phone (#58, #59) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Zerst');
    await register(page, name);
    seed({ name, b: { robot: 2, yard: 8, lab: 7 }, research: { hdrive: 5 } });
    await page.goto('/?view=shipyard');
    await expect(
      page.getByRole('img', { name: 'Schlachtkreuzer' }),
    ).toBeVisible();
    const dr = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Zerstörer/ }),
    });
    await expect(dr.getByRole('img', { name: 'Zerstörer' })).toBeVisible();
    await expect(
      dr.locator('.need-nm', { hasText: /^Raumschiffwerft$/ }),
    ).toBeVisible();
    await expect(dr.locator('[data-act=order]')).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('defense lists requirements with reasons on a phone (#64) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Wall');
    await register(page, name);
    seed({ name, b: { robot: 2, yard: 2, lab: 1 } });
    await page.goto('/?view=defense');
    const light = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Leichtes Lasergeschütz/ }),
    });
    const energy = light.locator('.need').filter({
      has: page.locator('.need-nm', { hasText: /^Energietechnik$/ }),
    });
    await expect(energy).toHaveClass(/missing/);
    await expect(energy).toContainText('zu wenig Kristall, Deuterium');
    await expect(
      light.locator('.need').filter({
        has: page.locator('.need-nm', { hasText: /^Lasertechnik$/ }),
      }),
    ).toContainText('braucht Energietechnik (Stufe 2)');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('the layout works on a phone @phone', async ({ page }) => {
    const w = watch(page);
    await register(page, uniqueName('Handy'));
    await expect(page.locator('#menu')).toBeHidden();
    await expect(page.locator('#tabbar')).toBeVisible();
    const overflow = (): Promise<number> =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
    await page.click('#tabbar [data-v=buildings]');
    await expect(page.locator('#tabbar a.on')).toHaveAttribute(
      'data-v',
      'buildings',
    );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await page.click('#tabbar [data-act=moreOpen]');
    await expect(page.locator('#more')).toBeVisible();
    await page.click('#more-list [data-v=galaxy]');
    await expect(page.locator('#more')).toBeHidden();
    await expect(page.locator('h2')).toContainText('Galaxie');
    await expect(page.locator('#tabbar [data-act=moreOpen]')).toHaveClass(/on/);
    expect(await overflow()).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });

  test('planet animations can be turned off for this device', async ({
    page,
  }) => {
    await register(page, uniqueName('Ruhe'));
    const surface = page.locator('.pl .pl-surface');
    await expect(surface).not.toHaveCSS('animation-name', 'none');
    await nav(page, 'help');
    await page.getByLabel('Animationen').uncheck();
    await nav(page, 'overview');
    await expect(surface).toHaveCSS('animation-name', 'none');
    await page.reload();
    await expect(surface).toHaveCSS('animation-name', 'none');
    await nav(page, 'help');
    await expect(page.getByLabel('Animationen')).not.toBeChecked();
  });
});

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
    const audit = page.getByRole('row', { name: /admin.read \/ player/ });
    await expect(audit).toContainText(name);
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

    await page.getByRole('tab', { name: 'Einladungen' }).click();
    // Invitation without SMTP: the link is shown for copying.
    await page.fill('#inv_email', 'freund@example.org');
    await page.click('#inviteform button[type=submit]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Kein SMTP eingerichtet',
    );
    await expect(page.locator('#inv_link')).toHaveValue(/#invite=[\w-]{43}$/);
    await expect(page.locator('#admin-invitations table.mini')).toContainText(
      'freund@example.org',
    );
    await page
      .locator('tr', { hasText: 'freund@example.org' })
      .locator('[data-act=revoke]')
      .click();
    await expect(
      page.locator('tr', { hasText: 'freund@example.org' }),
    ).toHaveCount(0);

    await page.getByRole('tab', { name: 'Universum' }).click();
    // Settings: live, but the universe never shrinks below a planet. The
    // planet in galaxy 2 comes from this test, not from an earlier one.
    seed({ name, colony: { g: 2, s: 1, p: 15, name: 'Außenposten' } });
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
