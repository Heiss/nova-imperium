// The „Endzeit“ (#161): the admin rings it in, the gift fleet from
// „Gottkaiser“ and its fleet list entry.
import { expect, test } from '@playwright/test';
import {
  lastToast,
  loginByCode,
  mailCli,
  mailSeed,
  nav,
  register,
  registerByMail,
  seed,
  stock,
  uniqueName,
  watch,
} from './helpers.ts';
import { report, shipCount } from './fleet-helpers.ts';

test.describe('fleet and battle (#68)', () => {
  test('the fleet list shows a gift from „Gottkaiser“ without „Rückruf“ on a phone (#161) @phone', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('GabeH');
    await register(page, name);
    // One gift for this player only: the trigger would reach every player.
    seed({ name, gift: 60 });
    await page.reload();
    const gift = page.locator('tr', { hasText: 'von Gottkaiser erreicht' });
    await expect(gift).toContainText('42 Weltenbrecher');
    await expect(gift).toContainText('Verlegung');
    await expect(gift).toBeInViewport();
    await expect(gift.getByRole('button', { name: 'Rückruf' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Rückruf' })).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
    expect(w.problems).toEqual([]);
  });
});

test.describe('admin (#68)', () => {
  // On the mail server after the new round: the gift goes to every player
  // there, and no test of that server comes after this one.
  test('the admin rings in the Endzeit: a gift from „Gottkaiser“ unlocks everything (#161)', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Endzeit');
    await registerByMail(page, name);
    mailCli('admin', name);
    mailSeed({ name, b: { robot: 25, metal: 3 } });
    await loginByCode(page, name);
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page.getByRole('button', { name: 'Endzeit einläuten' }).click();
    await expect(
      page.getByText(
        'Endzeit einläuten – alle Spieler erhalten die Gabe des Gottkaisers.',
      ),
    ).toBeVisible();
    // Prefilled from the setting of the form „Universum“ (owner, 2026-11-14).
    const time = page.getByLabel('Flugzeit der Gabe (Minuten)');
    await expect(time).toHaveValue('240');
    // The dialog checks the time as the server does and sends nothing
    // (F15, O18 (c), #214).
    const sent: unknown[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/api/action'))
        sent.push((r.postDataJSON() as { type?: string } | null)?.type);
    });
    await time.fill('0');
    await page.getByRole('button', { name: 'Ja, Endzeit einläuten' }).click();
    await expect(lastToast(page)).toContainText(
      'Bitte eine Flugzeit von 1 bis 4.320 Minuten (72 h) eingeben.',
    );
    expect(sent).not.toContain('endzeit');
    await page.getByRole('tab', { name: 'Universum' }).click();
    await page.getByRole('button', { name: 'Endzeit einläuten' }).click();
    await time.fill('30');
    await page.getByRole('button', { name: 'Ja, Endzeit einläuten' }).click();
    await expect(lastToast(page)).toContainText(
      'Die Endzeit ist eingeläutet. Gaben unterwegs:',
    );
    await page.getByRole('tab', { name: 'Universum' }).click();
    await expect(
      page.getByText('In dieser Runde wurde die Endzeit schon eingeläutet.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Endzeit einläuten' }),
    ).toHaveCount(0);
    // The time of the dialog was for this trigger only: the default stays.
    await expect(
      page.getByLabel('Flugzeit der Endzeit-Gabe (Minuten)'),
    ).toHaveValue('240');

    // The gift flies from „Gottkaiser“ and cannot be recalled.
    await nav(page, 'overview');
    const gift = page.locator('tr', { hasText: 'von Gottkaiser erreicht' });
    await expect(gift).toContainText('42 Weltenbrecher');
    await expect(gift).toContainText('Verlegung');
    await expect(gift.getByRole('button', { name: 'Rückruf' })).toHaveCount(0);
    await nav(page, 'messages');
    const start = report(page, 'Endzeit');
    await start.locator('.t').click();
    await expect(start).toContainText(
      'Der allwissende Gottkaiser war gnädig und hat die Endzeit eingeläutet.',
    );

    // It arrives: the message, the ships, the buildings.
    mailSeed({ name, landFleet: 'deploy' });
    const arrived = report(page, 'Die Gabe des Gottkaisers ist eingetroffen.');
    await expect(arrived).toBeVisible({ timeout: 15000 });
    await expect(report(page, /^Verlegung erreicht/)).toHaveCount(0);
    await expect(stock(page, 'Adamant')).toHaveText(/^1\.\d{3}\.\d{3}$/);
    await nav(page, 'buildings');
    const level = (building: string) =>
      page
        .locator('.item')
        .filter({
          has: page.locator('.nm', { hasText: new RegExp(`^\\s*${building}`) }),
        })
        .locator('.lv');
    await expect(level('Orbitale Schiffsschmiede')).toHaveText('(Stufe 20)');
    // Higher levels stay.
    await expect(level('Servitorenschmiede')).toHaveText('(Stufe 25)');
    await nav(page, 'fleet');
    await expect(shipCount(page, 'Weltenbrecher')).toHaveText('42');

    // The trigger is in the event log as an admin write.
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Ereignisprotokoll' }).click();
    const events = page.locator('[data-admin=events]');
    await page
      .getByLabel('Spieler', { exact: true })
      .selectOption({ label: name });
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    await expect(
      events.getByRole('row', { name: /admin\.write \/ endzeit/ }),
    ).toBeVisible();
    mailCli('unadmin', name);
    expect(w.problems).toEqual([]);
  });
});
