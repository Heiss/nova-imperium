import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  choosePlanet,
  expectShownPlace,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

// The header names the active planet once (#241): with one own place as
// text, „name [g:s:p] · Kommandant … · Logout“; with several only in the
// list „Aktiver Planet“, which comes first, then „Kommandant … · Logout“
// (D1 and D2 taken as recommended: the list first, the same on a phone).

/** axe (WCAG 2.1 A and AA) as in e2e/a11y.spec.ts, on the header line only. */
async function headerViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .include('#pinfo')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

/** The text of the header line without the list „Aktiver Planet“. */
const textBesideList = (page: Page): Promise<string> =>
  page.locator('#pinfo').evaluate((el) => {
    const copy = el.cloneNode(true) as HTMLElement;
    copy.querySelector('#planet_select')?.remove();
    return copy.textContent!.replace(/\s+/g, ' ').trim();
  });

async function headerFlow(page: Page): Promise<void> {
  const w = watch(page);
  const name = uniqueName('Kopfzeile');
  await register(page, name);
  const header = page.locator('#pinfo');
  // One planet: no list, so the header names it as text.
  await expect(header).toHaveText(
    new RegExp(
      `^Heimatplanet \\[\\d+:\\d+:\\d+\\] · Kommandant ${name} · Logout$`,
    ),
  );
  await expect(page.getByLabel('Aktiver Planet')).toHaveCount(0);
  expect(await headerViolations(page)).toEqual([]);

  seed({ name, colony: {} });
  await page.reload();
  // Two planets: the list comes first and names the active one; the header
  // does not name it again as text.
  await expectShownPlace(page, 'Heimatplanet');
  await expect(header.locator(':scope > :first-child')).toHaveId(
    'planet_select',
  );
  await expect(page.getByLabel('Aktiver Planet')).toBeVisible();
  await expect(header.locator('b')).toHaveText([name]);
  expect(await textBesideList(page)).toBe(`· Kommandant ${name} · Logout`);
  expect(await headerViolations(page)).toEqual([]);

  await choosePlanet(page, 'Kolonie');
  await expect(header.locator('b')).toHaveText([name]);
  expect(await textBesideList(page)).toBe(`· Kommandant ${name} · Logout`);
  expect(w.problems).toEqual([]);
}

test.describe('the header line (#241)', () => {
  test('names the active planet once', async ({ page }) => {
    await headerFlow(page);
  });

  test('names the active planet once on a phone @phone', async ({ page }) => {
    await headerFlow(page);
  });
});
