// The thin Runden-Rewind (#235, view G, okf/features/round-archive.md): the
// button „Rewind ansehen“ is in the row of a finished round the player took
// part in and not before the round ended; the Rewind shows the cards 1 (round
// identity), 6 (estimated active time with the method) and 8 (final place with
// the way to the full report), one after the other by the buttons, the arrow
// keys and a swipe; the heading of the card takes the focus; the automatic
// play can be paused; under reduced motion no card moves in; axe finds nothing.
// „Neue Runde“ resets the universe, so this runs on the second server of the
// E2E start, like e2e/round-archive.spec.ts (#68); the test starts its own
// round first. The texts are drafts [V] of the build, the checks hold the
// headlines of the issue and the structure.
import AxeBuilder from '@axe-core/playwright';
import {
  type Browser,
  devices,
  expect,
  test,
  type Locator,
  type Page,
} from '@playwright/test';
import {
  lastToast,
  loginByCode,
  mailCli,
  nav,
  optionsSection,
  registerByMail,
  uniqueName,
  watch,
} from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** The box „Rundenarchiv“ of „Hilfe & Optionen“. */
const archive = (page: Page): Locator =>
  page.locator('.box').filter({
    has: page.locator('.hd', { hasText: 'Rundenarchiv' }),
  });

/** The row of the finished round in the archive of the player. */
const finished = (page: Page): Locator =>
  archive(page)
    .locator('tr')
    .filter({ hasText: /Platz \d+ von \d+ · / });

/** The headline of the card that is shown. */
const headline = (page: Page): Locator => page.locator('#round-rewind-card-h');

/**
 * A round of its own with at least two participants, the admin and a player, closed by
 * the admin; the player has the archive open. Returns the player's page and
 * the problems both pages reported.
 */
async function closedRound(
  page: Page,
  browser: Browser,
): Promise<{ player: Page; problems: string[] }> {
  const w = watch(page);
  const boss = uniqueName('Spielleitung');
  const name = uniqueName('Teilnehmer');
  await registerByMail(page, boss);
  mailCli('admin', boss);
  await loginByCode(page, boss);
  await nav(page, 'admin');
  await page.getByRole('tab', { name: 'Universum' }).click();
  await page.getByRole('button', { name: 'Neue Runde starten' }).click();
  await page.getByRole('button', { name: 'Ja, neue Runde' }).click();
  await expect(lastToast(page)).toContainText('Neue Runde gestartet');

  // A context of its own (axe needs one), with the device of the project.
  const phone = (page.viewportSize()?.width ?? 1280) <= 760;
  const context = await browser.newContext(
    phone ? devices['Pixel 7'] : { viewport: page.viewportSize() },
  );
  const player = await context.newPage();
  const wp = watch(player);
  await registerByMail(player, name);
  await loginByCode(player, name);

  // While the round runs there is no Rewind and no report for a player.
  await nav(player, 'help');
  await optionsSection(player, 'Runde');
  await expect(
    archive(player).locator('tr').filter({ hasText: 'Nach Rundenende' }),
  ).toHaveCount(1);
  await expect(
    archive(player).getByRole('button', { name: 'Rewind ansehen' }),
  ).toHaveCount(0);

  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Runde abschließen' }).click();
  await expect(lastToast(page)).toContainText('abgeschlossen');
  mailCli('unadmin', boss);

  await player.reload();
  await nav(player, 'help');
  await optionsSection(player, 'Runde');
  await expect(finished(player)).toHaveCount(1);
  return { player, problems: [...w.problems, ...wp.problems] };
}

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} [${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}]`,
  );
}

test.describe('the Runden-Rewind (#235)', () => {
  test('a participant opens it after the round ended, turns the cards by buttons and keys and reaches the full report', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const { player, problems } = await closedRound(page, browser);
    const rewind = player.locator('section.rw');

    await finished(player)
      .getByRole('button', { name: 'Rewind ansehen' })
      .click();
    await expect(rewind).toBeVisible();
    // The list is gone, the heading of the card has the focus.
    await expect(
      archive(player).getByRole('button', { name: 'Bericht öffnen' }),
    ).toHaveCount(0);
    await expect(headline(player)).toBeFocused();

    // Card 1: round identity and participation.
    await expect(headline(player)).toHaveText('Dein Runden-Rewind');
    await expect(rewind.locator('.rw-figure')).toHaveText(/^\d+ Tage?$/);
    await expect(rewind).toContainText(/Du warst einer von \d+ Teilnehmern\./);
    await expect(
      rewind.getByRole('button', { name: 'Zurück', exact: true }),
    ).toBeDisabled();

    // Card 6: the estimated active time, with the method.
    await rewind.getByRole('button', { name: 'Weiter' }).click();
    await expect(headline(player)).toHaveText('Du warst nicht ständig hier.');
    await expect(headline(player)).toBeFocused();
    await expect(rewind.locator('.rw-figure')).toHaveText(
      /^(\d+ h \d\d|\d+ Min\.|unter 1 Min\.)$/,
    );
    await expect(rewind).toContainText(
      'Deine geschätzte aktive Zeit in dieser Runde.',
    );
    await expect(rewind).toContainText(
      'Methode: Gezählt wird die geschätzte Zeit',
    );

    // Card 8 by the arrow key; it is the last.
    await player.keyboard.press('ArrowRight');
    await expect(headline(player)).toHaveText('Dein Platz in der Chronik.');
    await expect(rewind.locator('.rw-figure')).toHaveText(/^\d+ von \d+$/);
    await expect(rewind.getByRole('button', { name: 'Weiter' })).toBeDisabled();
    // No fourth card: another key press stays.
    await player.keyboard.press('ArrowRight');
    await expect(headline(player)).toHaveText('Dein Platz in der Chronik.');
    await expect(rewind.locator('.rw-live')).toHaveText('Karte 3 von 3');

    // Back by the left arrow key, then forward again.
    await player.keyboard.press('ArrowLeft');
    await expect(headline(player)).toHaveText('Du warst nicht ständig hier.');
    await player.keyboard.press('ArrowRight');

    // Axe on the open Rewind.
    expect(await violations(player)).toEqual([]);

    // The link of card 8 opens the full report of the round.
    await rewind
      .getByRole('button', { name: 'Vollständigen Bericht öffnen' })
      .click();
    await expect(
      archive(player).getByRole('heading', { name: /^Runde \d+$/ }),
    ).toBeFocused();
    await expect(archive(player)).toContainText('Dein Platz');
    await expect(rewind).toHaveCount(0);

    // Back to the list, and the Rewind can be opened again from the first card.
    await archive(player)
      .getByRole('button', { name: 'Zurück zum Archiv' })
      .click();
    await finished(player)
      .getByRole('button', { name: 'Rewind ansehen' })
      .click();
    await expect(headline(player)).toHaveText('Dein Runden-Rewind');
    await archive(player)
      .getByRole('button', { name: 'Zurück zum Archiv' })
      .click();
    await expect(finished(player)).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test('the automatic play is off until asked for, pauses and turns the cards by itself', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const { player, problems } = await closedRound(page, browser);
    const rewind = player.locator('section.rw');
    await finished(player)
      .getByRole('button', { name: 'Rewind ansehen' })
      .click();
    await expect(headline(player)).toHaveText('Dein Runden-Rewind');

    // Nothing moves by itself while it is not asked for.
    await player.clock.install();
    await player.clock.runFor(20_000);
    await expect(headline(player)).toHaveText('Dein Runden-Rewind');

    // Play: the cards turn, and the live line tells the card now shown.
    await rewind.getByRole('button', { name: 'Automatisch abspielen' }).click();
    await expect(rewind.getByRole('button', { name: 'Pause' })).toBeVisible();
    await player.clock.runFor(7_100);
    await expect(headline(player)).toHaveText('Du warst nicht ständig hier.');
    await expect(rewind.locator('.rw-live')).toContainText(
      'Karte 2 von 3: Du warst nicht ständig hier.',
    );

    // Pause: it stays on the card.
    await rewind.getByRole('button', { name: 'Pause' }).click();
    await player.clock.runFor(30_000);
    await expect(headline(player)).toHaveText('Du warst nicht ständig hier.');
    await expect(
      rewind.getByRole('button', { name: 'Automatisch abspielen' }),
    ).toBeVisible();

    // Play on to the last card: it stops there and offers the replay.
    await rewind.getByRole('button', { name: 'Automatisch abspielen' }).click();
    await player.clock.runFor(7_100);
    await expect(headline(player)).toHaveText('Dein Platz in der Chronik.');
    await expect(
      rewind.getByRole('button', { name: 'Noch einmal abspielen' }),
    ).toBeVisible();
    await player.clock.runFor(30_000);
    await expect(headline(player)).toHaveText('Dein Platz in der Chronik.');
    expect(problems).toEqual([]);
  });

  test('no card moves in under reduced motion', async ({ page, browser }) => {
    test.setTimeout(120_000);
    const { player, problems } = await closedRound(page, browser);
    const rewind = player.locator('section.rw');
    const motion = (): Promise<string> =>
      player
        .locator('.rw-in')
        .evaluate((el) => getComputedStyle(el).animationName);

    await finished(player)
      .getByRole('button', { name: 'Rewind ansehen' })
      .click();
    await expect(rewind).toHaveAttribute('data-still', 'false');
    expect(await motion()).toBe('rw-in');
    await archive(player)
      .getByRole('button', { name: 'Zurück zum Archiv' })
      .click();

    await player.emulateMedia({ reducedMotion: 'reduce' });
    await finished(player)
      .getByRole('button', { name: 'Rewind ansehen' })
      .click();
    await expect(rewind).toHaveAttribute('data-still', 'true');
    expect(await motion()).toBe('none');
    // The content is all there.
    await expect(headline(player)).toHaveText('Dein Runden-Rewind');
    await rewind.getByRole('button', { name: 'Weiter' }).click();
    await expect(headline(player)).toHaveText('Du warst nicht ständig hier.');
    expect(await motion()).toBe('none');
    expect(problems).toEqual([]);
  });

  test('@phone a swipe turns the cards and the Rewind fits the screen', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const { player, problems } = await closedRound(page, browser);
    const rewind = player.locator('section.rw');
    const card = rewind.locator('.rw-card');
    await finished(player)
      .getByRole('button', { name: 'Rewind ansehen' })
      .click();
    await expect(headline(player)).toHaveText('Dein Runden-Rewind');

    /** A touch stroke of `dx` and `dy` pixels over the card. */
    const swipe = async (dx: number, dy = 0): Promise<void> => {
      const box = (await card.boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      const base = { pointerType: 'touch', isPrimary: true, bubbles: true };
      await card.dispatchEvent('pointerdown', {
        ...base,
        clientX: x,
        clientY: y,
      });
      await card.dispatchEvent('pointerup', {
        ...base,
        clientX: x + dx,
        clientY: y + dy,
      });
    };

    // A short stroke and a vertical one (scrolling) turn nothing.
    await swipe(-20);
    await swipe(-80, 120);
    await expect(headline(player)).toHaveText('Dein Runden-Rewind');
    // To the left turns forward, to the right back.
    await swipe(-120);
    await expect(headline(player)).toHaveText('Du warst nicht ständig hier.');
    await expect(headline(player)).toBeFocused();
    await swipe(-120);
    await expect(headline(player)).toHaveText('Dein Platz in der Chronik.');
    await swipe(-120);
    await expect(headline(player)).toHaveText('Dein Platz in der Chronik.');
    await swipe(120);
    await expect(headline(player)).toHaveText('Du warst nicht ständig hier.');

    // No horizontal scrolling of the page, axe finds nothing.
    const overflow = await player.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await violations(player)).toEqual([]);
    expect(problems).toEqual([]);
  });
});
