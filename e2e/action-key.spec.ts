// A repeated action runs once (#450): the browser sends every action with a
// key of its own in the header `Idempotency-Key`, and the server runs a
// request with a key it has already run only once. A script that posts the
// same action twice with one key changes the game once.
import { expect, test } from '@playwright/test';
import { nav, register, seed, uniqueName, watch } from './helpers.ts';

test('the same action posted twice with one key runs once; the browser sends a key per action (#450)', async ({
  page,
}) => {
  const w = watch(page);
  const name = uniqueName('Schluessel');
  await register(page, name);
  seed({ name, res: { m: 10000, c: 10000, d: 10000 } });
  await page.reload();
  const origin = new URL(page.url()).origin;
  const pct = (v: number, key: string) =>
    page.request.post('/api/action', {
      data: { type: 'pct', key: 'metal', v },
      headers: { origin, 'idempotency-key': key },
    });
  const metalPct = async (): Promise<number> =>
    (
      (await (await page.request.get('/api/state')).json()) as {
        planet: { pct: Record<string, number> };
      }
    ).planet.pct.metal ?? 100;

  expect((await pct(50, 'k-once')).status()).toBe(200);
  expect(await metalPct()).toBe(50);
  // The same key again, though the body differs: the first answer, no run.
  const again = await pct(30, 'k-once');
  expect(again.status()).toBe(200);
  expect(await metalPct()).toBe(50);
  // A new key runs.
  expect((await pct(30, 'k-twice')).status()).toBe(200);
  expect(await metalPct()).toBe(30);

  // The page sends a key of its own with an action of a click.
  await nav(page, 'buildings');
  const sent = page.waitForRequest(
    (r) => r.url().endsWith('/api/action') && r.method() === 'POST',
  );
  await page.click('[data-act=build][data-k=metal]');
  const key = (await sent).headers()['idempotency-key'];
  expect(key).toMatch(/^[0-9a-f-]{36}$/);
  expect(w.problems).toEqual([]);
});
