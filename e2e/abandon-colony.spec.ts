// Giving up a colony (#224, okf/features/abandon-colony.md): the overview
// offers „Kolonie aufgeben“ on a colony, not on the main planet; the
// confirmation names the coordinates, the losses with the moon and the lock,
// and asks for the password. A wrong password changes nothing, the server
// refuses the main planet, and a colonization of the given-up position is
// refused with the end of its lock. Desktop and phone, with axe on the
// overview and the confirmation.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  choosePlanet,
  expectShownPlace,
  register,
  seed,
  uniqueName,
  watch,
} from './helpers.ts';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const PASSWORD = 'ein-sicheres-testpasswort';

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.help}`);
}

const lastToast = (page: Page): Locator => page.locator('.toast').last();

/** The coordinates of the shown planet, from the header. */
async function here(page: Page): Promise<{ g: number; s: number; p: number }> {
  const header = await page.locator('#pinfo').innerText();
  const [, g, s, p] = /\[(\d+):(\d+):(\d+)\]/.exec(header)!;
  return { g: Number(g), s: Number(s), p: Number(p) };
}

/** An action as from another device: the refusal of the server. */
const refusal = (page: Page, data: object): Promise<string | undefined> =>
  page.evaluate(async (body) => {
    const r = await fetch('/api/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return ((await r.json()) as { error?: string }).error;
  }, data);

async function abandonFlow(page: Page): Promise<void> {
  const { problems } = watch(page);
  const player = uniqueName('Aufgabe');
  const colony = uniqueName('Aussen');
  await register(page, player);
  const home = await here(page);
  const first = (await page.locator('#pinfo').innerText()).trim();
  const homeName = /^(.*?) \[/.exec(first)?.[1] ?? 'Heimatplanet';
  // The colony lies in another system of the home galaxy, on slot 1, which
  // no other test uses: homes lie on 4 to 12, and the colonies of the other
  // tests on 15, 14, 13, 9 and 3 have flights of their players, which
  // refuse the give-up for every player while they fly. The home planet gets
  // a Kolonistenarche for the colonization at the end.
  const at = { g: home.g, s: home.s === 1 ? 2 : home.s - 1, p: 1 };
  const position = `[${at.g}:${at.s}:${at.p}]`;
  seed({
    name: player,
    ships: { colony: 1 },
    colony: {
      ...at,
      name: colony,
      b: { metal: 3 },
      res: { m: 1500, c: 700, d: 0 },
    },
  });
  await page.reload();
  await expectShownPlace(page, homeName);

  // Not on the main planet (D3): the first planet without a choice.
  await expect(page.locator('h2')).toContainText('Übersicht');
  const offer = page.getByRole('button', { name: 'Kolonie aufgeben' });
  await expect(offer).toHaveCount(0);
  const homeId = `p${home.g}_${home.s}_${home.p}`;
  expect(
    await refusal(page, {
      type: 'abandon',
      target: homeId,
      password: PASSWORD,
    }),
  ).toBe(
    'Der Hauptplanet kann nicht aufgegeben werden. Wähle zuerst einen anderen Hauptplaneten.',
  );

  await choosePlanet(page, colony);
  await expect(offer).toBeVisible();
  expect(await violations(page)).toEqual([]);
  await offer.click();
  const form = page.locator('#abandonform');
  await expect(form).toContainText(`${colony} ${position} wird aufgegeben.`);
  await expect(form).toContainText('Gebäude: 3 Stufen');
  await expect(form).toContainText(
    'Rohstoffe: Adamant 1.500 · Psikristall 700',
  );
  await expect(form).toContainText(
    `Die Position ${position} ist danach 24 Stunden lang gesperrt.`,
  );
  await expect(form).toContainText(
    'Diese Aktion kann nicht rückgängig gemacht werden.',
  );
  expect(await violations(page)).toEqual([]);

  // A wrong password changes nothing.
  await form.getByLabel('Passwort zur Bestätigung').fill('falsches-passwort');
  await form.getByRole('button', { name: 'Kolonie aufgeben' }).click();
  await expect(lastToast(page)).toContainText(
    'Das bisherige Passwort ist falsch.',
  );
  await expect(form).toBeVisible();
  await form.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(form).toHaveCount(0);
  await expectShownPlace(page, colony);

  await offer.click();
  await form.getByLabel('Passwort zur Bestätigung').fill(PASSWORD);
  await form.getByRole('button', { name: 'Kolonie aufgeben' }).click();
  await expect(lastToast(page)).toContainText(
    `Die Kolonie ${colony} ${position} wurde aufgegeben.`,
  );
  await expect(form).toHaveCount(0);
  // Only the first planet is left: the header names it without a list.
  await expect(page.getByLabel('Aktiver Planet')).toHaveCount(0);
  await expect(page.locator('#pinfo')).toContainText(homeName);
  await expect(page.locator('h2')).toContainText(homeName);

  // The position is locked for colonization with the end of the lock (D2).
  expect(
    await refusal(page, {
      type: 'send',
      planet: homeId,
      mission: 'colonize',
      ships: { colony: 1 },
      to: at,
    }),
  ).toMatch(
    /^Diese Position ist gesperrt\. Wieder besiedelbar ab \d\d\.\d\d\.\d{4}, \d\d:\d\d\.$/,
  );
  expect(problems).toEqual([]);
}

test('a colony is given up with the password, the position stays locked', async ({
  page,
}) => {
  await abandonFlow(page);
});

test('giving up a colony on a phone @phone', async ({ page }) => {
  await abandonFlow(page);
});
