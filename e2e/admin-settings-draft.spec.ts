// The settings of the universe keep what the admin typed over a redraw
// (okf/features/admin.md). The fields of the tab „Universum“ show the settings
// of the server; the list of the round archive (#235) is read when the admin
// page is drawn and draws it again when it arrives, which used to put the
// server's values back over a value typed meanwhile, and the save sent the old
// values without a refusal. The unit tests of src/client/features/admin.test.ts
// cover the draft with a fake page; here the answer of the archive is held
// back with `page.route`, so the order is the same on every machine.
import { expect, test, type Page } from '@playwright/test';
import {
  cli,
  lastToast,
  login,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

/**
 * Holds back the two actions that read the archive (`roundArchive` and
 * `roundHistory`) until `release()` is called; every other action goes on.
 */
async function holdArchive(page: Page): Promise<() => void> {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/api/action', async (route) => {
    const body = route.request().postDataJSON() as { type?: string } | null;
    if (body?.type === 'roundArchive' || body?.type === 'roundHistory')
      await gate;
    await route.continue();
  });
  return release;
}

/** Opens the tab „Universum“ of a new admin while the archive is still held back. */
async function openUniverse(
  page: Page,
  base: string,
): Promise<{ release: () => void }> {
  const name = uniqueName(base);
  await register(page, name);
  expect(cli('admin', name)).toContain(`${name} is now admin.`);
  await page.reload();
  const release = await holdArchive(page);
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await expect(
    page.getByText('Das Archiv wird geladen …', { exact: true }),
  ).toBeVisible();
  return { release };
}

/** Waits for the answer of the archive: the box „Rundenberichte“ is drawn with the list. */
async function archiveArrived(page: Page): Promise<void> {
  await expect(page.getByText('Das Archiv wird geladen …')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Runde abschließen' }),
  ).toBeVisible();
}

test.describe('the draft of the settings of the universe', () => {
  test('a refused value typed before the archive arrived is still in the field, and the refusal names it', async ({
    page,
  }) => {
    const w = watch(page);
    const { release } = await openUniverse(page, 'EntwurfNein');
    // A universe of one galaxy is refused while any planet lies in a later one.
    await page.fill('#set_galaxies', '1');
    release();
    await archiveArrived(page);
    await expect(page.locator('#set_galaxies')).toHaveValue('1');

    await page.click('[data-act=saveSettings]');
    await expect(page.locator('.toast.err').last()).toContainText(
      /Galaxien: mindestens \d+/,
    );
    // The refusal keeps the draft as well.
    await expect(page.locator('#set_galaxies')).toHaveValue('1');
    expect(w.problems).toEqual([]);
  });

  test('an accepted value typed before the archive arrived is saved as typed', async ({
    page,
  }) => {
    const w = watch(page);
    const { release } = await openUniverse(page, 'EntwurfJa');
    const speed = page.locator('#set_speed');
    const before = await speed.inputValue();
    const typed = String(Number(before) + 2);
    await speed.fill(typed);
    release();
    await archiveArrived(page);
    await expect(speed).toHaveValue(typed);
    try {
      await page.click('[data-act=saveSettings]');
      await expect(page.locator('#unisub')).toHaveText(
        `Classic Universum · Speed x${typed}`,
      );
      // Saved: the field shows the server's value, no draft is left.
      await expect(speed).toHaveValue(typed);
    } finally {
      // The speed is a setting of the one server all tests share.
      await speed.fill(before);
      await page.click('[data-act=saveSettings]');
      await expect(page.locator('#unisub')).toHaveText(
        `Classic Universum · Speed x${before}`,
      );
    }
    expect(w.problems).toEqual([]);
  });

  test('a value typed in another round is not kept: a new round, drawn by the poll, shows the saved value (#361, review of #347)', async ({
    page,
    browser,
  }) => {
    const w = watch(page);
    const name = uniqueName('EntwurfRunde');
    await register(page, name);
    expect(cli('admin', name)).toContain(`${name} is now admin.`);
    // A colony, so the new round shows by the list of planets: it has one.
    seed({ name, colony: { name: uniqueName('Altkolonie') } });
    await page.reload();
    const planets = page.locator('#planet_select option');
    await expect(planets).toHaveCount(2);
    await nav(page, 'admin');
    await page.getByRole('tab', { name: 'Universum' }).click();
    const speed = page.locator('#set_speed');
    const before = await speed.inputValue();
    await speed.fill(String(Number(before) + 2));

    // The same admin starts a new round in another tab.
    const other = await (
      await browser.newContext({ viewport: page.viewportSize() })
    ).newPage();
    try {
      await login(other, name);
      await nav(other, 'admin');
      await other.getByRole('tab', { name: 'Universum' }).click();
      await other.getByRole('button', { name: 'Neue Runde starten' }).click();
      await other.getByRole('button', { name: 'Ja, neue Runde' }).click();
      await expect(lastToast(other)).toContainText('Neue Runde gestartet');
    } finally {
      await other.context().close();
    }

    // The poll draws the new round (one planet, no choice); the draft of the old round
    // is gone, so the field shows the server's value and a save sends it.
    await expect(planets).toHaveCount(0, { timeout: 15000 });
    await expect(speed).toHaveValue(before);
    cli('unadmin', name);
    expect(w.problems).toEqual([]);
  });
});
