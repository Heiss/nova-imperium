// The Sternenkarte as a Svelte component (#118, bundle 2): it is mounted
// anew on every render, as its HTML view was rendered, so what main.ts does
// around the view still works: the focus returns to the field „System“
// after Enter, the planets get their textures, and the fields show the
// shown system. Desktop and phone.
import { expect, test, type Page } from '@playwright/test';
import {
  galaxyAction,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

async function stepAndType(page: Page): Promise<void> {
  const w = watch(page);
  const name = uniqueName('Sternkarte');
  await register(page, name);
  seed({ name, colony: {} });
  await page.reload();
  await nav(page, 'galaxy');
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
  const [, g, s] = /\[(\d+):(\d+):\d+\]/.exec(
    (await page.locator('#pinfo').textContent())!,
  )!;
  const gal = page.getByLabel('Galaxie', { exact: true });
  const sys = page.getByLabel('System', { exact: true });
  await expect(gal).toHaveValue(g!);
  await expect(sys).toHaveValue(s!);
  const home = page.locator('table.gal tr.me', { hasText: 'Heimatplanet' });
  await expect(home).toContainText('Aktiver Planet');
  // main.ts paints the textures of the mounted planets (no inline styles).
  await expect(home.locator('.pl-surface')).toHaveCSS(
    'background-image',
    /url\(/,
  );
  await expect(page.locator('.box .bd.dim').last()).toHaveText(
    /^Auspex-Erkundung schickt \d+ Spähschädel – einstellbar unter „Optionen“\.$/,
  );
  // Enter shows the typed system, and the focus stays in the field.
  const other = s === '1' ? '2' : '1';
  await sys.fill(other);
  await sys.press('Enter');
  await expect(sys).toHaveValue(other);
  await expect(sys).toBeFocused();
  await expect(home).toHaveCount(0);
  // A step with ▶ shows the next system; „zum Heimatsystem“ goes back.
  await page.getByRole('button', { name: 'nächstes System' }).click();
  await expect(sys).toHaveValue(String(Number(other) + 1));
  await page.getByText('zum Heimatsystem').click();
  await expect(sys).toHaveValue(s!);
  await expect(home).toContainText('Aktiver Planet');
  // The colony offers „Wechseln“: in its row, on a phone in the sheet of its „⋯“ (#189).
  await expect(
    await galaxyAction(
      page,
      page.locator('table.gal tr.me', { hasText: 'Kolonie' }),
      'Wechseln',
    ),
  ).toBeVisible();
  expect(w.problems).toEqual([]);
}

test.describe('the Sternenkarte as a component (#118)', () => {
  test('keeps the fields, the focus after Enter and the planet textures', async ({
    page,
  }) => {
    await stepAndType(page);
  });

  test('keeps the fields, the focus after Enter and the planet textures on a phone @phone', async ({
    page,
  }) => {
    await stepAndType(page);
    // Against the device width: a too wide table also widens innerWidth.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(page.viewportSize()!.width);
  });
});
