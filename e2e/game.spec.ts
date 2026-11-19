import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  cli,
  nav,
  register,
  seed,
  uniqueName,
  watch,
  withWebPush,
} from './helpers.ts';
// The display texts of the catalog entries (#113); `text` is a local name below.
import { text as entryText } from '../src/core/text.ts';

/** The paragraphs of a long text (#94): the lore, then „So funktioniert es:“. */
const lines = (text: string): string[] => text.split('\n\n');

test.describe('explanation texts (#63, the „?“ opens the Lexicanum since #285)', () => {
  const question = (page: Page, name: string): Locator =>
    page.getByRole('button', { name: `Erklärung zu ${name}` });
  const row = (page: Page, name: string): Locator =>
    page.locator('.item').filter({
      has: page.locator('.nm', { hasText: new RegExp(`^\\s*${name}\\b`) }),
    });
  const panel = (page: Page): Locator => page.locator('#lexicanum-panel');

  /** Chooses the display option in „Hilfe & Optionen“ and saves it. */
  async function choose(page: Page, label: string): Promise<void> {
    await nav(page, 'help');
    await page.getByLabel('(?)-Symbol').selectOption({ label });
    await page.click('[data-act=saveopt]');
    await expect(page.locator('.toast').last()).toContainText('Gespeichert.');
  }

  test('the (?) opens the article by click and keyboard; the option changes the lists and survives a reload', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Lies');
    await register(page, name);
    seed({ name, b: { lab: 1, robot: 2, yard: 2 } });
    await page.goto('/?view=buildings');

    // Default „Anzeigen“ (D2): the short text is shown, the long one (#94)
    // is the introduction of the article in the side panel.
    const mine = row(page, 'Adamant-Tiefbohrung');
    const mineQ = question(page, 'Adamant-Tiefbohrung');
    await expect(mine.locator('.ds')).toHaveText(
      'Fördert Adamant, den wichtigsten Grundrohstoff.',
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'false');
    await mineQ.click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('metal')!.lt!),
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'true');
    await expect(mineQ).toHaveAttribute('aria-controls', 'lexicanum-panel');
    await expect(page.locator('#view .ex')).toHaveCount(0);
    // The (?) of another entry shows its article instead.
    await question(page, 'Psikristall-Steinbruch').click();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('crystal')!.lt!),
    );
    await expect(mineQ).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);

    await nav(page, 'research');
    const spyQ = question(page, 'Auspex-Lehre');
    await spyQ.focus();
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('spy')!.lt!),
    );
    await expect(spyQ).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(spyQ).toBeFocused();
    await page.keyboard.press('Space');
    await expect(panel(page)).toBeVisible();
    await spyQ.click();
    await expect(panel(page)).toHaveCount(0);

    // Ships and defense have the (?) and their article as well (#94).
    await nav(page, 'shipyard');
    await question(page, 'Spähschädel').click();
    await expect(panel(page).locator('.lx-intro p')).toHaveText(
      lines(entryText('probe')!.lt!),
    );
    await expect(question(page, 'Sonnenreliquiar')).toHaveCount(1);
    // The panel closes when its list is left.
    await nav(page, 'overview');
    await expect(panel(page)).toHaveCount(0);

    await choose(page, 'Ausblenden');
    await nav(page, 'buildings');
    await expect(page.locator('#view .exq')).toHaveCount(0);
    await expect(mine.locator('.ds')).toBeVisible();
    await page.reload();
    await expect(mine.locator('.ds')).toBeVisible();
    await expect(page.locator('#view .ex, #view .exq')).toHaveCount(0);
    await nav(page, 'research');
    await expect(row(page, 'Auspex-Lehre').locator('.ds')).toBeVisible();
    await expect(page.locator('#view .ex, #view .exq')).toHaveCount(0);
    await nav(page, 'help');
    await expect(page.getByLabel('(?)-Symbol')).toHaveValue('hidden');
    await choose(page, 'Anzeigen');
    await nav(page, 'buildings');
    await expect(mineQ).toBeVisible();
    expect(w.problems).toEqual([]);
  });

  test('a tap on the (?) opens the article as a page on a phone @phone', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Tipp'));
    await page.click('#tabbar [data-v=buildings]');
    await question(page, 'Sonnenkathedrale').tap();
    await expect(page).toHaveURL(/[?&]view=lexicanum&a=solar$/);
    await expect(page.locator('#view .lx-intro p')).toHaveText(
      lines(entryText('solar')!.lt!),
    );
    await expect(panel(page)).toHaveCount(0);
    await page.goBack();
    await expect(question(page, 'Sonnenkathedrale')).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
    expect(w.problems).toEqual([]);
  });
});

test.describe('push kinds (#192)', () => {
  const KINDS = [
    'Gebäude fertig',
    'Forschung abgeschlossen',
    'Auftrag der Schiffsschmiede abgeschlossen',
    'Eigene Flotten: Ankunft, Bericht und Rückkehr',
    'Sturmangriff auf deine Planeten',
    'Auspex-Aktivität bei deinen Planeten',
    'Lieferung eines anderen Spielers',
    'Servernachrichten',
    'Neue Version',
    'Gildenereignisse',
    'Nachrichten im Gilden-Chat',
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
  }

  test('the box is hidden on a server without Web Push (owner, 2026-11-14)', async ({
    page,
  }) => {
    const w = watch(page);
    await register(page, uniqueName('Stumm'));
    await nav(page, 'help');
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
    await kind(page, 'Neue Version').click();
    await kind(page, 'Servernachrichten').click();
    await expect(kind(page, 'Neue Version')).not.toBeChecked();
    await expect(kind(page, 'Servernachrichten')).not.toBeChecked();
    await expect.poll(() => answered).toBe(2);
    await page.reload();
    await nav(page, 'help');
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

test.describe('admin', () => {
  test('an admin can inspect a player and audit the data access', async ({
    page,
    browser,
  }) => {
    const name = uniqueName('Audit');
    const pilot = uniqueName('Pilot');
    const other = await browser.newPage();
    await register(other, pilot);
    await nav(other, 'buildings');
    await other.click('[data-act=build][data-k=metal]');
    await expect(other.getByText('Ausbau auf Stufe 1')).toBeVisible();
    await register(page, name);
    cli('admin', name);
    await page.reload();
    await nav(page, 'admin');
    await expect(
      page.getByRole('button', { name: 'Erste Seite' }),
    ).toBeDisabled();
    await expect(page.getByLabel('Pro Seite')).toHaveValue('10');
    await page.getByRole('tab', { name: 'Spieler', exact: true }).click();
    await page
      .locator('[data-admin=stats]')
      .getByRole('button', { name: pilot, exact: true })
      .click();
    await expect(
      page.getByRole('heading', { name: `Spielerakte · ${pilot}` }),
    ).toBeVisible();
    await page
      .getByRole('button', { name: 'Ereignisse zu diesem Spieler' })
      .click();
    await expect(
      page.getByRole('row', { name: /game \/ build/ }),
    ).toContainText(pilot);
    await page.getByLabel('Spieler', { exact: true }).selectOption('');
    await page.getByLabel('Aktion', { exact: true }).fill('player');
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click();
    const audit = page.getByRole('row', { name: /admin.read \/ player/ });
    await expect(audit).toContainText(name);
    await expect(audit).toContainText(pilot);
    await other.close();
  });

  test('only an admin made by the operator sees the admin panel', async ({
    page,
  }) => {
    const w = watch(page);
    const name = uniqueName('Chef');
    await register(page, name);
    await expect(page.locator('#menu [data-v=admin]')).toHaveCount(0);
    expect(cli('admin', name)).toContain(`${name} is now admin.`);
    await page.reload();
    await nav(page, 'admin');
    await expect(page.locator('h2')).toHaveText('Admin');

    await page.getByRole('tab', { name: 'Einladungen' }).click();
    // Invitation without SMTP: the link is shown for copying.
    await page.fill('#inv_email', 'freund@example.org');
    await page.click('#inviteform button[type=submit]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Kein SMTP eingerichtet',
    );
    await expect(page.locator('#inv_link')).toHaveValue(/#invite=[\w-]{43}$/);
    await expect(page.locator('#admin-invitations table.mini')).toContainText(
      'freund@example.org',
    );
    await page
      .locator('tr', { hasText: 'freund@example.org' })
      .locator('[data-act=revoke]')
      .click();
    await expect(
      page.locator('tr', { hasText: 'freund@example.org' }),
    ).toHaveCount(0);

    await page.getByRole('tab', { name: 'Universum' }).click();
    // Settings: live, but the universe never shrinks below a planet. The
    // planet in galaxy 2 comes from this test, not from an earlier one.
    seed({ name, colony: { g: 2, s: 1, p: 15, name: 'Außenposten' } });
    await page.fill('#set_speed', '7');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x7',
    );
    await page.fill('#set_galaxies', '1');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('.toast.err').last()).toContainText(
      'Galaxien: mindestens 2',
    );
    await page.fill('#set_galaxies', '2');
    await page.fill('#set_speed', '5');
    await page.click('[data-act=saveSettings]');
    await expect(page.locator('#unisub')).toHaveText(
      'Classic Universum · Speed x5',
    );
    expect(cli('unadmin', name)).toContain('no longer admin');
    expect(w.problems).toEqual([]);
  });
});
