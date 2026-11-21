// A new round started by the admin: accounts stay, planets and research are
// new (#68).
import { expect, test } from '@playwright/test';
import {
  lastToast,
  loginByCode,
  mailCli,
  mailSeed,
  nav,
  registerByMail,
  uniqueName,
  watch,
} from './helpers.ts';

test.describe('admin (#68)', () => {
  test('the admin starts a new round: accounts stay, planets and research are new', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Runde');
    await registerByMail(page, name);
    mailCli('admin', name);
    mailSeed({ name, b: { metal: 5, lab: 1 }, research: { energy: 2 } });
    await loginByCode(page, name);
    await nav(page, 'buildings');
    const mine = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Adamant-Tiefbohrung/ }),
    });
    await expect(mine.locator('.lv')).toHaveText('(Stufe 5)');
    const energy = page.locator('.item').filter({
      has: page.locator('.nm', { hasText: /^\s*Machina-Energetik/ }),
    });
    await nav(page, 'research');
    await expect(energy.locator('.lv')).toHaveText('(Stufe 2)');
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page.getByRole('button', { name: 'Neue Runde starten' }).click();
    await expect(
      page.getByText('Wirklich eine neue Runde starten?'),
    ).toBeVisible();
    await expect(page.getByLabel('Tagesbelohnungen aktivieren')).toBeChecked();
    await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
    await expect(lastToast(page)).toContainText(
      'Neue Runde gestartet – alle Spieler haben einen frischen Planeten.',
    );
    await expect(page.locator('#pinfo')).toContainText(name);
    await nav(page, 'buildings');
    await expect(mine.locator('.lv')).toHaveText('');
    await nav(page, 'research');
    await expect(page.locator('.notice')).toHaveText(
      'Für Forschung brauchst du ein Scholarium.',
    );
    // A Scholarium on the new planet shows the research: back to level 0.
    mailSeed({ name, b: { lab: 1 } });
    await page.reload();
    await expect(energy.locator('.lv')).toHaveText('');
    await expect(energy.locator('[data-act=research]')).toHaveText('Forschen');
    mailCli('unadmin', name);
    expect(w.problems).toEqual([]);
  });
});
