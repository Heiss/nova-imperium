// Guilds: founding one with its profile, applying, declining, accepting,
// handing over the lead, leaving and removing a member (#68).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { lastToast, nav, register, uniqueName, watch } from './helpers.ts';

test('creates a guild and restores its profile after reload', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Gruender');
  // A unique tag and name: the server refuses a second guild with either, so
  // a fixed „NOVA“ failed on a repeat run (#267). „N“ and 6 random
  // characters, in capitals: the tag takes 2 to 8 letters or digits.
  const tag = uniqueName('N').toUpperCase();
  const guild = `Nova Allianz ${tag}`;
  await register(page, name);
  await nav(page, 'guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(guild);
  await page.getByLabel('Gildentext (Markdown)').fill('**Gemeinsam ins All**');
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page).toHaveURL(/view=guilds&guild=/);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: `[${tag}] ${guild}` }),
  ).toBeVisible();
  await expect(
    page.locator('strong', { hasText: 'Gemeinsam ins All' }),
  ).toBeVisible();
  await expect(page.getByRole('cell', { name, exact: true })).toBeVisible();
  expect(w.problems).toEqual([]);
});

test.describe('guilds (#68)', () => {
  test('apply, decline and accept, transfer the lead, leave and remove a member', async ({
    page,
    browser,
  }) => {
    const founder = uniqueName('Leiter');
    const a = uniqueName('Erbe');
    const b = uniqueName('Gast');
    const tag = `G${Date.now() % 1000000}`;
    const title = `[${tag}] Gilde ${tag}`;
    const w = watch(page);
    await register(page, founder);
    await nav(page, 'guilds');
    await page.getByLabel('Kürzel').fill(tag);
    await page.getByLabel('Name', { exact: true }).fill(`Gilde ${tag}`);
    await page.getByRole('button', { name: 'Gilde gründen' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

    const apply = async (p: Page): Promise<void> => {
      await nav(p, 'guilds');
      await p.getByRole('link', { name: title }).click();
      await p.getByRole('button', { name: 'Bewerben' }).click();
      await expect(lastToast(p)).toContainText('Bewerbung gesendet.');
      await expect(p.getByText('Deine Bewerbung ist offen.')).toBeVisible();
    };
    const pa = await browser.newPage();
    const wa = watch(pa);
    await register(pa, a);
    await apply(pa);
    const pb = await browser.newPage();
    const wb = watch(pb);
    await register(pb, b);
    await apply(pb);

    const confirm = (p: Page): void =>
      void p.once('dialog', (dialog) => void dialog.accept());
    const member = (p: Page, n: string): Locator =>
      p
        .locator('tr')
        .filter({ has: p.getByRole('cell', { name: n, exact: true }) });
    const applicant = (p: Page, n: string): Locator =>
      p.locator('p', { hasText: n });
    await page.reload();
    await applicant(page, b).getByRole('button', { name: 'Ablehnen' }).click();
    await expect(lastToast(page)).toContainText('Bewerbung abgelehnt.');
    await applicant(page, a).getByRole('button', { name: 'Annehmen' }).click();
    await expect(lastToast(page)).toContainText('Bewerbung angenommen.');
    await expect(page.getByText('Keine offenen Bewerbungen.')).toBeVisible();
    await expect(member(page, a)).toContainText('Mitglied');
    await member(page, a)
      .getByRole('button', { name: 'Leitung übergeben' })
      .click();
    // The hand-over dialog of #163: the own new rank, here the only one.
    await page
      .locator('#modal')
      .getByRole('button', { name: 'Übergeben' })
      .click();
    await expect(lastToast(page)).toContainText('Gildenleitung übergeben.');
    await expect(member(page, a)).toContainText('Leitung');
    await expect(member(page, founder)).toContainText('Mitglied');
    confirm(page);
    await page.getByRole('button', { name: 'Gilde verlassen' }).click();
    await expect(lastToast(page)).toContainText('Gilde verlassen.');
    await expect(member(page, founder)).toHaveCount(0);

    await pb.reload();
    await expect(pb.getByText('Deine Bewerbung ist offen.')).toHaveCount(0);
    await pb.getByRole('button', { name: 'Bewerben' }).click();
    await expect(lastToast(pb)).toContainText('Bewerbung gesendet.');
    await pa.reload();
    await applicant(pa, b).getByRole('button', { name: 'Annehmen' }).click();
    await expect(member(pa, b)).toContainText('Mitglied');
    confirm(pa);
    await member(pa, b).getByRole('button', { name: 'Entfernen' }).click();
    await expect(lastToast(pa)).toContainText('Mitglied entfernt.');
    await expect(member(pa, b)).toHaveCount(0);
    await pb.reload();
    await expect(pb.getByRole('button', { name: 'Bewerben' })).toBeVisible();
    await pa.close();
    await pb.close();
    expect([...w.problems, ...wa.problems, ...wb.problems]).toEqual([]);
  });
});
