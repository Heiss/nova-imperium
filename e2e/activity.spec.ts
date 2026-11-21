// The activity markers on the Sternenkarte (#229,
// okf/features/activity-indicators.md): another player's planet shows
// „Aktiv“ after a login, then „Aktivität vor
// x Minuten“ up to 59 minutes and nothing after an hour; the player shows
// „Inaktiv“ after 7 days and „Lange inaktiv“ after 28 days, apart from the
// noob protection (n). The times are set with e2e/seed.ts. Desktop and
// phone, with axe on the Sternenkarte.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  galaxyRow,
  logout,
  nav,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Opens the system of `player` from the highscore. */
async function openSystemOf(page: Page, player: string): Promise<void> {
  await nav(page, 'highscore');
  await page
    .locator('tr')
    .filter({ has: page.getByRole('cell', { name: player, exact: true }) })
    .locator('[data-act=gto]')
    .click();
  await expect(page.locator('h2')).toHaveText('Sternenkarte');
}

async function activityFlow(page: Page): Promise<void> {
  const { problems } = watch(page);
  const other = uniqueName('Aktiv');
  const me = uniqueName('Beob');
  // The other player registers (a login) and leaves.
  await register(page, other);
  await logout(page);
  await register(page, me);
  await openSystemOf(page, other);
  const row = galaxyRow(page, other);
  await expect(row).toContainText('(Aktiv)');
  expect(
    (await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations.map(
      (v) => `${v.id}: ${v.help}`,
    ),
  ).toEqual([]);

  const shown = async (ago: number): Promise<void> => {
    seed({ name: other, activeAgo: ago });
    await page.reload();
    await openSystemOf(page, other);
  };
  await shown(20 * MINUTE + 5000);
  await expect(row).toContainText('(Aktivität vor 20 Minuten)');
  await expect(row).not.toContainText('inaktiv', { ignoreCase: true });

  await shown(61 * MINUTE);
  await expect(row).not.toContainText('Aktivität');

  await shown(8 * DAY);
  await expect(row).toContainText(`${other} (Platz`);
  await expect(row).toContainText('(Inaktiv)');
  await expect(row).not.toContainText('Lange');

  await shown(29 * DAY);
  await expect(row).toContainText('(Lange inaktiv)');
  await expect(row).not.toContainText('Aktivität');
  expect(problems).toEqual([]);
}

test('the Sternenkarte shows activity and inactivity in words', async ({
  page,
}) => {
  await activityFlow(page);
});

test('activity and inactivity on a phone @phone', async ({ page }) => {
  await activityFlow(page);
});
