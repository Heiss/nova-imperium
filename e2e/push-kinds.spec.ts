// The push kinds in the options (#192) and the browser notifications of a
// server without Web Push (#68).
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  lastToast,
  nav,
  optionsSection,
  register,
  uniqueName,
  watch,
  withWebPush,
} from './helpers.ts';

test.describe('push kinds (#192)', () => {
  const KINDS = [
    'Gebäude fertig',
    'Forschung abgeschlossen',
    'Auftrag der Schiffsschmiede abgeschlossen',
    'Eigene Flotten: Ankunft, Bericht und Rückkehr',
    'Sturmangriff auf deine Planeten',
    'Auspex-Aktivität bei deinen Planeten',
    'Lieferung eines anderen Spielers',
    // The reports of a hold (#440, 243b).
    'Wachen',
    'Servernachrichten',
    'Neue Version',
    'Gildenereignisse',
    'Nachrichten im Gilden-Chat',
    'Persönliche Nachrichten',
  ];
  const kinds = (page: Page): Locator =>
    page.getByRole('group', { name: 'Welche Meldungen per Push kommen' });
  const kind = (page: Page, name: string): Locator =>
    kinds(page).getByRole('checkbox', { name, exact: true });

  /** Every kind with its checkbox state, in the order of the options. */
  async function states(page: Page): Promise<[string, boolean][]> {
    const out: [string, boolean][] = [];
    for (const name of KINDS)
      out.push([name, await kind(page, name).isChecked()]);
    return out;
  }

  /** Switches one kind with `toggle`, waits for the save and reloads. */
  async function switchKind(
    page: Page,
    name: string,
    toggle: (box: Locator) => Promise<void>,
  ): Promise<void> {
    await toggle(kind(page, name));
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
    await page.reload();
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
  }

  test('the box is hidden on a server without Web Push (owner, 2026-11-14)', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Stumm'));
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    const titles = page.locator('.box .hd');
    await expect(
      titles.getByText('Browser-Benachrichtigungen', { exact: true }),
    ).toBeVisible();
    await expect(
      titles.getByText('Benachrichtigungen', { exact: true }),
    ).toHaveCount(0);
    await expect(kinds(page)).toHaveCount(0);
    await expect(page.locator('[data-chg=push]')).toHaveCount(0);
    expect(w.problems).toEqual([]);
  });

  test('every kind is on; one is switched off and on again and survives a reload', async ({
    page,
  }) => {
    const w = watch(page);
    await withWebPush(page);
    await register(page, uniqueName('Glocke'));
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    await expect(
      page.locator('.box .hd').getByText('Benachrichtigungen', { exact: true }),
    ).toBeVisible();
    await expect(kinds(page).getByRole('checkbox')).toHaveCount(KINDS.length);
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));

    await switchKind(page, 'Sturmangriff auf deine Planeten', (box) =>
      box.uncheck(),
    );
    expect(await states(page)).toEqual(
      KINDS.map((n) => [n, n !== 'Sturmangriff auf deine Planeten']),
    );

    // By keyboard: Space switches it on again, the focus stays on it.
    const attacked = kind(page, 'Sturmangriff auf deine Planeten');
    await attacked.focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
    await expect(attacked).toBeChecked();
    await expect(attacked).toBeFocused();
    await page.reload();
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));
    expect(w.problems).toEqual([]);
  });

  test('two quick changes both stay, even when the first save is slow (CodeRabbit on #204)', async ({
    page,
  }) => {
    const w = watch(page);
    await withWebPush(page);
    // The first save reaches the server late, as on a slow connection; a
    // second save sent meanwhile would arrive first and be overwritten.
    let saves = 0;
    let answered = 0;
    await page.route('**/api/action', async (route) => {
      const body = route.request().postDataJSON() as { type?: string };
      if (body.type === 'pushOptions' && ++saves === 1)
        await new Promise((resolve) => setTimeout(resolve, 800));
      await route.continue();
    });
    page.on('response', (r) => {
      if (
        r.url().endsWith('/api/action') &&
        r.request().postDataJSON()?.type === 'pushOptions'
      )
        answered++;
    });
    await register(page, uniqueName('Eilig'));
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    await kind(page, 'Neue Version').click();
    await kind(page, 'Servernachrichten').click();
    await expect(kind(page, 'Neue Version')).not.toBeChecked();
    await expect(kind(page, 'Servernachrichten')).not.toBeChecked();
    await expect.poll(() => answered).toBe(2);
    await page.reload();
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    expect(await states(page)).toEqual(
      KINDS.map((n) => [n, n !== 'Neue Version' && n !== 'Servernachrichten']),
    );
    expect(w.problems).toEqual([]);
  });

  test('a kind is switched off and on again on a phone @phone', async ({
    page,
  }) => {
    const w = watch(page);
    await withWebPush(page);
    await register(page, uniqueName('Klingel'));
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));
    await switchKind(page, 'Nachrichten im Gilden-Chat', (box) => box.tap());
    expect(await states(page)).toEqual(
      KINDS.map((n) => [n, n !== 'Nachrichten im Gilden-Chat']),
    );
    await switchKind(page, 'Nachrichten im Gilden-Chat', (box) => box.tap());
    expect(await states(page)).toEqual(KINDS.map((n) => [n, true]));
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});

test.describe('push and economy (#68)', () => {
  test('browser notifications: this server without Web Push says so; „Deaktivieren“ works', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['notifications']);
    const w = watch(page);
    await register(page, uniqueName('Push'));
    await nav(page, 'help');
    await optionsSection(page, 'Gerät');
    await page.getByRole('button', { name: 'Aktivieren', exact: true }).click();
    await expect(page.locator('.toast.err').last()).toContainText(
      'Browser-Benachrichtigungen sind auf diesem Server deaktiviert.',
    );
    await page
      .getByRole('button', { name: 'Deaktivieren', exact: true })
      .click();
    await expect(lastToast(page)).toHaveText('Benachrichtigungen deaktiviert.');
    expect(w.problems).toEqual([]);
  });
});
