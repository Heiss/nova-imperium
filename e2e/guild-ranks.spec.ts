// Guild ranks with configurable rights (#163): the Leitung creates a rank,
// gives it the right for applications and a member; that member accepts an
// application, a member without the right is refused by the server. Desktop
// and phone.
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from '@playwright/test';
import { nav, register, uniqueName, watch } from './helpers.ts';

const lastToast = (page: Page): Locator => page.locator('.toast').last();
const member = (p: Page, name: string): Locator =>
  p.locator('tr').filter({ has: p.getByRole('cell', { name, exact: true }) });
const applicant = (p: Page, name: string): Locator =>
  p.locator('p', { hasText: name });
const RIGHT = 'Bewerbungen annehmen und ablehnen';

async function rankFlow(page: Page, browser: Browser): Promise<void> {
  const lead = uniqueName('Leitung');
  const officer = uniqueName('Offizier');
  const plain = uniqueName('Gefolge');
  const first = uniqueName('Anwaerter');
  const second = uniqueName('Zweiter');
  const tag = `R${Date.now() % 1000000}`;
  const title = `[${tag}] Ränge ${tag}`;
  const problems: { problems: string[] }[] = [watch(page)];
  await register(page, lead);
  await nav(page, 'guilds');
  await page.getByLabel('Kürzel').fill(tag);
  await page.getByLabel('Name', { exact: true }).fill(`Ränge ${tag}`);
  await page.getByRole('button', { name: 'Gilde gründen' }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  /** A new player who applies to the guild. */
  const applying = async (name: string): Promise<Page> => {
    const p = await browser.newPage();
    problems.push(watch(p));
    await register(p, name);
    await nav(p, 'guilds');
    await p.getByRole('link', { name: title }).click();
    // Outside the guild the ranks are not shown (owner, D7).
    await expect(p.getByRole('columnheader', { name: 'Rang' })).toHaveCount(0);
    await expect(p.getByText('Leitung', { exact: true })).toHaveCount(0);
    await p.getByRole('button', { name: 'Bewerben' }).click();
    await expect(lastToast(p)).toContainText('Bewerbung gesendet.');
    return p;
  };
  const po = await applying(officer);
  const pp = await applying(plain);
  await page.reload();
  for (const n of [officer, plain]) {
    await applicant(page, n).getByRole('button', { name: 'Annehmen' }).click();
    await expect(lastToast(page)).toContainText('Bewerbung angenommen.');
    await expect(member(page, n).locator('td.rank')).toHaveText('Mitglied');
  }
  await expect(member(page, lead).locator('td.rank')).toHaveText('Leitung');

  // The Leitung creates a rank, moves it up and gives it the right.
  await page.getByLabel('Name des neuen Rangs').fill('Offizier');
  await page.getByRole('button', { name: 'Rang anlegen' }).click();
  await expect(lastToast(page)).toContainText('Rang angelegt.');
  const rank = page.getByRole('group', { name: 'Offizier', exact: true });
  await expect(rank.getByLabel(RIGHT)).not.toBeChecked();
  await rank.getByRole('button', { name: 'Nach oben' }).click();
  await expect(lastToast(page)).toContainText('Rang verschoben.');
  await expect(page.locator('fieldset.rank legend')).toHaveText([
    'Leitung',
    'Offizier',
    'Mitglied · Standardrang',
  ]);
  await rank.getByLabel(RIGHT).check();
  await rank.getByRole('button', { name: 'Rechte speichern' }).click();
  await expect(lastToast(page)).toContainText('Rechte gespeichert.');
  await page.reload();
  await expect(rank.getByLabel(RIGHT)).toBeChecked();
  await member(page, officer)
    .getByLabel(`Neuer Rang für ${officer}`)
    .selectOption({ label: 'Offizier' });
  await member(page, officer)
    .getByRole('button', { name: 'Rang ändern' })
    .click();
  await expect(lastToast(page)).toContainText('Rang vergeben.');
  await expect(member(page, officer).locator('td.rank')).toHaveText('Offizier');

  // The member with the right accepts an application.
  const pf = await applying(first);
  await po.reload();
  await expect(member(po, officer).locator('td.rank')).toHaveText('Offizier');
  await applicant(po, first).getByRole('button', { name: 'Annehmen' }).click();
  await expect(lastToast(po)).toContainText('Bewerbung angenommen.');
  await expect(member(po, first).locator('td.rank')).toHaveText('Mitglied');

  // The member without it sees no application and is refused by the server.
  const ps = await applying(second);
  await po.reload();
  const uid = await applicant(po, second)
    .getByRole('button', { name: 'Annehmen' })
    .getAttribute('data-uid');
  await pp.reload();
  await expect(member(pp, plain).locator('td.rank')).toHaveText('Mitglied');
  await expect(pp.getByRole('button', { name: 'Annehmen' })).toHaveCount(0);
  await expect(pp.getByText(second)).toHaveCount(0);
  // As from another device that still showed the button.
  const refused = await pp.evaluate(async (id) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'reviewGuildApplication',
        uid: id,
        accept: true,
      }),
    });
    return ((await r.json()) as { error?: string }).error;
  }, uid);
  expect(refused).toBe('Dazu fehlt deinem Rang das Recht.');
  await po.reload();
  await expect(applicant(po, second)).toBeVisible();
  for (const p of [po, pp, pf, ps]) await p.close();
  expect(problems.flatMap((w) => w.problems)).toEqual([]);
}

test.describe('guild ranks (#163)', () => {
  test('a rank with the right accepts an application, one without is refused', async ({
    page,
    browser,
  }) => {
    await rankFlow(page, browser);
  });

  test('a rank with the right accepts an application, one without is refused, on a phone @phone', async ({
    page,
    browser,
  }) => {
    await rankFlow(page, browser);
    expect(page.viewportSize()!.width).toBeLessThanOrEqual(760);
  });
});
