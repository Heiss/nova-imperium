// The moon chance set by the admin (#433, owner, 2026-11-27): the cap
// „Mondchance höchstens (%)“ and „Rohstoffe je 1 % Mondchance“ stand in the
// tab „Universum“ and in the dialog „Neue Runde“ with 20 and 100,000 by
// default and take effect at once. With the cap at 100, a Trümmerfeld of
// 10,000,000 Adamant gives 100 %, so the moon forms without depending on
// chance. The universe is shared by the tests: the cap is put back.
import { expect, test, type Page } from '@playwright/test';
import {
  cli,
  logout,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const CAP = 'Mondchance höchstens (%)';
const PER = 'Rohstoffe je 1 % Mondchance';

/** Sets the cap in the tab „Universum“ and saves. */
async function saveCap(page: Page, value: string): Promise<void> {
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page
    .locator('#admin-panel-universe')
    .getByLabel(CAP, { exact: true })
    .fill(value);
  await page.getByRole('button', { name: 'Einstellungen speichern' }).click();
  await expect(page.locator('.toast').last()).toContainText(
    'Einstellungen gespeichert.',
  );
}

test('the admin sets the cap of the moon chance; a big battle then forms a moon at 100 % (#433)', async ({
  page,
}) => {
  const w = watch(page);
  const a = uniqueName('MondAdmin');
  const b = uniqueName('MondFeld');
  await register(page, b);
  await logout(page);
  await register(page, a);
  cli('admin', a);
  await page.reload();
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  const universe = page.locator('#admin-panel-universe');
  const cap = universe.getByLabel(CAP, { exact: true });
  await expect(cap).toHaveValue('20');
  await expect(cap).toHaveAttribute('min', '1');
  await expect(cap).toHaveAttribute('max', '100');
  const per = universe.getByLabel(PER, { exact: true });
  await expect(per).toHaveValue('100000');
  await expect(per).toHaveAttribute('min', '10000');
  await expect(per).toHaveAttribute('max', '1000000');
  await expect(per).toHaveAttribute('step', '10000');
  // In „Neue Runde“ too; the dialog is closed without a new round.
  await universe.getByRole('button', { name: 'Neue Runde starten' }).click();
  const modal = page.locator('#modal');
  await expect(modal.getByLabel(CAP, { exact: true })).toHaveValue('20');
  await expect(modal.getByLabel(PER, { exact: true })).toHaveValue('100000');
  await expect(modal.getByLabel(PER, { exact: true })).toHaveAttribute(
    'step',
    '10000',
  );
  await page.keyboard.press('Escape');
  try {
    await saveCap(page, '100');
    seed({ name: a, ships: { lf: 5, sc: 2 }, res: { m: 0, c: 0, d: 10000 } });
    // Points against the noob protection; 10,000,000 Adamant: 100 %.
    seed({
      name: b,
      b: { metal: 12, crystal: 10 },
      ships: { probe: 1 },
      res: { m: 50000, c: 50000, d: 50000 },
      debris: { m: 10_000_000, c: 0 },
    });
    await nav(page, 'highscore');
    await page
      .locator('tr')
      .filter({ has: page.getByRole('cell', { name: b, exact: true }) })
      .locator('[data-act=gto]')
      .click();
    await page
      .locator('tr')
      .filter({
        has: page.locator('td', { hasText: new RegExp(`^${b} \\(Platz`) }),
      })
      .getByText('Sturmangriff')
      .click();
    await page.getByLabel('Anzahl Abfangjäger').fill('5');
    await page.getByRole('button', { name: 'Flotte losschicken' }).click();
    await expect(page.locator('.toast').last()).toContainText(
      'Flotte unterwegs nach',
    );
    seed({ name: a, landFleet: 'attack' });
    await expect(page.locator('#menu [data-v=messages] .badge')).toBeVisible({
      timeout: 15000,
    });
    await nav(page, 'messages');
    const battle = page
      .locator('.rep')
      .filter({ has: page.locator('.t', { hasText: /^Kampfbericht/ }) });
    await battle.locator('.t').click();
    await expect(battle).toContainText('Mondchance: 100 %');
    await expect(battle).toContainText(
      'Die enormen Mengen an freiem Adamant und Psikristall ziehen sich an und formen einen Trabanten um den Planeten.',
    );
  } finally {
    await saveCap(page, '20');
  }
  cli('unadmin', a);
  expect(w.problems).toEqual([]);
});
