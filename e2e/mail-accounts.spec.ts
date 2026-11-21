// Accounts by mail (#68, #272): the login code and „Passwort vergessen“, on
// the second server with the mail sink (e2e/env.ts, e2e/mail.ts).
import { expect, test } from '@playwright/test';
import {
  emailOf,
  lastToast,
  loginByCode,
  mail,
  mailCli,
  registerByMail,
  uniqueName,
  watch,
} from './helpers.ts';
import { E2E_MAIL_URL } from './env.ts';

test.describe('accounts by mail (#68)', () => {
  test('a login needs the code from the mail; a wrong code is refused', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Code');
    await registerByMail(page, name);
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');
    const [, code] = await mail(emailOf(name), /Anmeldecode lautet (\d{6})\./);
    const wrong = code!.replace(/\d$/, (d) => String((Number(d) + 1) % 10));
    const field = page.getByLabel('Sechsstelliger Code aus deiner E-Mail');
    await field.fill(wrong);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Der Anmeldecode ist ungültig oder abgelaufen.',
    );
    await field.fill(code!);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('h2')).toContainText('Übersicht');
    await expect(page.locator('#pinfo')).toContainText(name);
    expect(w.problems).toEqual([]);
  });

  test('an invitation link shows no login while the server checks it (#272)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Einladung');
    mailCli('invite', emailOf(name));
    const [link] = await mail(emailOf(name), /^http:\S+#invite=[\w-]+$/m);
    // The check of the invitation waits until the test has looked: the
    // login rendered after the 401 of /api/state took the name and the
    // password, and the registration replaced it empty (#272).
    let pending!: () => void;
    const checking = new Promise<void>((resolve) => (pending = resolve));
    let answer!: () => void;
    const looked = new Promise<void>((resolve) => (answer = resolve));
    await page.route('**/api/invite/check', async (route) => {
      pending();
      await looked;
      await route.continue();
    });
    await page.goto(link);
    await checking;
    await expect(page.locator('#authform')).toHaveCount(0);
    await expect(page.locator('#view')).toHaveText('Lade Universum …');
    answer();
    await expect(page.locator('.auth .hd')).toHaveText(
      'Neues Imperium gründen',
    );
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(lastToast(page)).toContainText(
      'Konto erstellt. Melde dich jetzt an.',
    );
    expect(w.problems).toEqual([]);
  });

  test('„Passwort vergessen“ sends a link that sets a new password once', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Vergessen');
    await registerByMail(page, name);
    await page.getByRole('button', { name: 'Passwort vergessen?' }).click();
    await page
      .getByLabel('Hinterlegte E-Mail-Adresse')
      .fill(emailOf(name).toUpperCase());
    await page.getByRole('button', { name: 'Link anfordern' }).click();
    await expect(lastToast(page)).toContainText(
      'Falls die Adresse hinterlegt ist, erhältst du einen Link per E-Mail.',
    );
    const [link] = await mail(emailOf(name), /http:\S+#reset=[\w-]{43}/);
    expect(link.startsWith(`${E2E_MAIL_URL}/#reset=`)).toBe(true);
    await page.goto('about:blank');
    await page.goto(link);
    await expect(page.locator('.auth .hd')).toHaveText(
      'Neues Passwort festlegen',
    );
    await page.getByLabel('Neues Passwort').fill('ein-neues-testpasswort');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(lastToast(page)).toContainText(
      'Passwort gespeichert. Melde dich mit deinem neuen Passwort an.',
    );
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(page.locator('.toast.err').last()).toHaveText(
      'Name oder Passwort falsch.',
    );
    await loginByCode(page, name, 'ein-neues-testpasswort');

    await page.goto('about:blank');
    await page.goto(link);
    await page.getByLabel('Neues Passwort').fill('ein-drittes-testpasswort');
    await page.getByRole('button', { name: 'Passwort speichern' }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Dieser Link ist ungültig oder abgelaufen.',
    );
    expect(w.problems).toEqual([]);
  });
});
