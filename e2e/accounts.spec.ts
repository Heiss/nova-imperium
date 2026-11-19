// Accounts: the login page, registering with an invitation, a passkey,
// deleting the account, changing the password, logging out and in.
import { expect, test } from '@playwright/test';
import {
  inviteLink,
  login,
  logout,
  nav,
  register,
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
    await logout(page);
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
    await logout(page);
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
