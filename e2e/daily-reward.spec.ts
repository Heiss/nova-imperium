// The daily reward and the achievements filter (#220), desktop and phone.
import { expect, test, type Page } from '@playwright/test';
import { nav, register, seed, stock, uniqueName, watch } from './helpers.ts';
import { rewardMinutes } from '../src/core/daily-reward.ts';

/** The amount of a resource in the bar, as a number. */
const amountOf = async (page: Page, label: string): Promise<number> =>
  Number((await stock(page, label).textContent())!.replaceAll('.', ''));

/**
 * Opens the rewards, checks the day of the round with its minutes (#220),
 * claims the daily reward and checks that the bar rises by the amount shown
 * under „Heute“. The base income may add one more unit of Adamant and
 * Psikristall between the two readings; Promethium has no income without a
 * mine.
 */
async function claimsShownDailyReward(page: Page): Promise<void> {
  await nav(page, 'achievements');
  const round = page.getByText(/^Tag \d+ der Runde: \d+ Minuten/);
  await expect(round).toBeVisible();
  const [, day, minutes] = /Tag (\d+) der Runde: (\d+) Minuten/.exec(
    (await round.textContent())!,
  )!;
  expect(Number(minutes)).toBe(rewardMinutes(Number(day)));
  const today = page.locator('[data-daily-reward]');
  const [, m, c, d] =
    /Heute: Adamant ([\d.]+) · Psikristall ([\d.]+) · Promethium ([\d.]+)/.exec(
      (await today.textContent())!,
    )!;
  const shown = [m, c, d].map((n) => Number(n!.replaceAll('.', '')));
  // The median production of all players is at least the base income.
  expect(shown[0]).toBeGreaterThan(0);
  const before = [
    await amountOf(page, 'Adamant'),
    await amountOf(page, 'Psikristall'),
    await amountOf(page, 'Promethium'),
  ];
  await page.getByRole('button', { name: 'Tagesbelohnung abholen' }).click();
  await expect(today.getByText('Abgeholt', { exact: true })).toBeVisible();
  await expect
    .poll(async () => (await amountOf(page, 'Promethium')) - before[2]!)
    .toBe(shown[2]);
  for (const [i, label] of ['Adamant', 'Psikristall'].entries()) {
    const gain = (await amountOf(page, label)) - before[i]!;
    expect(gain).toBeGreaterThanOrEqual(shown[i]!);
    expect(gain).toBeLessThanOrEqual(shown[i]! + 1);
  }
}

test('claims the shown daily reward, filters achievements and keeps tomorrow’s reward', async ({
  page,
}) => {
  await register(page, uniqueName('Erfolg'));
  const badge = page.locator('#menu [data-v=achievements] .badge');
  await expect(badge).toHaveAttribute('aria-label', 'Tagesbelohnung abholbar');
  await nav(page, 'achievements');
  const next = page.getByText(
    /^Morgen \(\d+ Minuten, bei gleicher Produktion\):/,
  );
  await expect(next).toBeVisible();
  const reward = await next.textContent();
  await claimsShownDailyReward(page);
  await expect(next).toHaveText(reward!);
  await expect(badge).toHaveCount(0);
  await page.getByLabel('Kategorie', { exact: true }).selectOption('buildings');
  await page.getByLabel('Suchen', { exact: true }).fill('Adamant-Tiefbohrung');
  const visible = page.locator('[data-achievement]:visible');
  await expect(visible.first()).toContainText('Adamant-Tiefbohrung');
  await expect(
    page.locator('[data-achievement]:visible:not([data-category=buildings])'),
  ).toHaveCount(0);
});

test('claims the shown daily reward on a phone (#220) @phone', async ({
  page,
}) => {
  const w = watch(page);
  await register(page, uniqueName('Belohnt'));
  await claimsShownDailyReward(page);
  expect(w.problems).toEqual([]);
});

/**
 * Counts the game actions of one type the page sends and waits for their
 * answers, so a refusal of a second request would already show its toast.
 */
function countActions(page: Page, type: string) {
  const answers: Promise<unknown>[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.postData()?.includes(type))
      answers.push(r.response());
  });
  return {
    sent: async (): Promise<number> => {
      await Promise.all(answers);
      return answers.length;
    },
  };
}

test('a double click on „Abholen“ claims once and shows no error (#425)', async ({
  page,
}) => {
  const name = uniqueName('Doppel');
  await register(page, name);
  // Level 1 of the Servitor-Schmiede makes its first achievement claimable.
  seed({ name, b: { robot: 1 } });
  await page.reload();
  await nav(page, 'achievements');
  const claims = countActions(page, 'claimAchievement');
  const daily = countActions(page, 'claimDailyReward');
  const claim = page.locator(
    'button[data-act=achievementClaim][data-id="buildings:robot:1"]',
  );
  await expect(claim).toHaveText('Abholen');
  await claim.dblclick();
  await expect(claim).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Tagesbelohnung abholen', exact: true })
    .dblclick();
  await expect(
    page.locator('[data-daily-reward]').getByText('Abgeholt', { exact: true }),
  ).toBeVisible();
  expect(await claims.sent()).toBe(1);
  expect(await daily.sent()).toBe(1);
  await expect(page.locator('.toast.err')).toHaveCount(0);
});
