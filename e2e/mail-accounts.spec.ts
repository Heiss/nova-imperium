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
    await expect(page.locator('.auth')).toContainText(
      'Wir haben dir einen Code per E-Mail geschickt.',
    );
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

  test('the code form offers „Code erneut senden“ after 30 s (101b, #401)', async ({
    page,
  }) => {
    const w = watch(page);
    await page.clock.install();
    const name = uniqueName('Neucode');
    await registerByMail(page, name);
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');
    const again = page.getByRole('button', { name: 'Code erneut senden' });
    await expect(again).toHaveCount(0);
    await page.clock.fastForward(29_000);
    await expect(again).toHaveCount(0);
    await page.clock.fastForward(1_000);
    await expect(again).toBeVisible();
    // Asked for, the button waits another 30 s.
    await again.click();
    await expect(again).toHaveCount(0);
    await page.clock.fastForward(30_000);
    await expect(again).toBeVisible();
    const [, code] = await mail(emailOf(name), /Anmeldecode lautet (\d{6})\./);
    await page.getByLabel('Sechsstelliger Code aus deiner E-Mail').fill(code!);
    await page.getByRole('button', { name: 'Anmelden' }).click();
    await expect(page.locator('h2')).toContainText('Übersicht');
    expect(w.problems).toEqual([]);
  });

  test('the link of the mail signs in only the browser of the sign-in (95a, 129a, 130b, #401)', async ({
    page,
    browser,
  }) => {
    const w = watch(page);
    const name = uniqueName('Link');
    await registerByMail(page, name);
    const begin = async (): Promise<void> => {
      await page.fill('#a_name', name);
      await page.fill('#a_pw', 'ein-sicheres-testpasswort');
      await page.click('button[type=submit]');
      await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');
    };
    /** The link of the newest mail, on this server; not `old`. */
    const newestLink = async (old = 'none'): Promise<string> => {
      const code = old.replace(/\D/g, '') || 'x';
      const [, path] = await mail(
        emailOf(name),
        new RegExp(`Link an: http://[^/]+(/#code=(?!${code})\\d{6})\\. `),
      );
      return `${E2E_MAIL_URL}${path!}`;
    };
    await begin();
    const first = await newestLink();
    // A reload of the code step keeps the sign-in (129a).
    await page.reload();
    await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');

    // Another browser: nothing signed in, the note says where to go (text 2).
    const other = await browser.newContext();
    const phone = await other.newPage();
    await phone.goto(first);
    await expect(lastToast(phone)).toContainText(
      'Dieser Link gilt nur im Browser, in dem du die Anmeldung begonnen hast. Gib dort den Code aus der E-Mail ein.',
    );
    await expect(phone.locator('.auth .hd')).toHaveText('Login');
    await expect(phone).toHaveURL(/\/$/);
    await other.close();

    // A newer sign-in here: the old link is of an older one (130b), and the
    // code step stays for the newest code.
    await page.getByRole('button', { name: 'Zurück zum Login' }).click();
    await begin();
    // (A second code equal to the first, one in a million, would wait here.)
    const second = await newestLink(first);
    await page.goto(first);
    await expect(lastToast(page)).toContainText(
      'Dieser Link gehört zu einer älteren Anmeldung. Gib den Code aus der neuesten E-Mail ein.',
    );
    await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');
    // The newest link signs in, and the code leaves the address bar.
    await page.goto(second);
    await expect(page.locator('h2')).toContainText('Übersicht');
    await expect(page.locator('#pinfo')).toContainText(name);
    await expect(page).toHaveURL(/\/$/);
    expect(w.problems).toEqual([]);
  });

  test('„Zurück zum Login“ ends the sign-in under way (#401)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Zurueck');
    await registerByMail(page, name);
    await page.fill('#a_name', name);
    await page.fill('#a_pw', 'ein-sicheres-testpasswort');
    await page.click('button[type=submit]');
    await expect(page.locator('.auth .hd')).toHaveText('Anmeldecode');
    await page.getByRole('button', { name: 'Zurück zum Login' }).click();
    await expect(page.locator('.auth .hd')).toHaveText('Login');
    await page.reload();
    await expect(page.locator('.auth .hd')).toHaveText('Login');
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
