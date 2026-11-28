// The checkbox „Keine Wachen annehmen“ of „Optionen“ (#440, PR #469): while
// its save runs it shows the click; when the server refuses the save, the
// box shows the option the server keeps again, though the page renders the
// same value as before the click.
import { expect, test } from '@playwright/test';
import { lastToast, nav, register, uniqueName, watch } from './helpers.ts';

test('a refused save of „Keine Wachen annehmen“ shows the option of the server again (#469)', async ({
  page,
}) => {
  const w = watch(page);
  await register(page, uniqueName('Waechter'));
  await nav(page, 'help');
  const box = page.getByLabel('Keine Wachen annehmen');
  await expect(box).not.toBeChecked();
  let answer: (() => Promise<void>) | null = null;
  await page.route('**/api/action', async (route) => {
    const body = route.request().postDataJSON() as { type?: string };
    if (body.type !== 'holdOption') return route.continue();
    answer = () =>
      route.fulfill({ status: 400, json: { error: 'Abgefangen.' } });
  });
  await box.click();
  // The click stays shown while the save runs.
  await expect.poll(() => answer !== null).toBe(true);
  await expect(box).toBeChecked();
  await answer!();
  await expect(lastToast(page)).toContainText('Abgefangen.');
  await expect(box).not.toBeChecked();
  expect(w.problems).toEqual([]);
});
