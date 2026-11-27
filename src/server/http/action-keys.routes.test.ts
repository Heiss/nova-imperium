// A repeated action runs once, through the routes (#450): POST /api/action
// and the admin writes, keyed by the player and the header Idempotency-Key.
import { describe, expect, it } from 'vitest';
import { addPlanet, addUser } from '../test-helpers.ts';
import { asAdmin, start } from '../../test/http.ts';
import { KEPT_MS } from './action-keys.ts';
import { ACTIONS_PER_MINUTE } from './action-limit.ts';

const KEY = 'idempotency-key';

async function anna() {
  const s = await start();
  addUser(s.ctx, 'Anna');
  addPlanet(s.ctx, 'u_Anna', { res: { m: 10_000, c: 10_000, d: 10_000 } });
  expect(
    (await s.call('POST', '/api/login', { name: 'anna', password: 'secret1' }))
      .status,
  ).toBe(200);
  return s;
}

/** The audit entries of an action. */
const audits = (s: Awaited<ReturnType<typeof anna>>, action: string) =>
  (
    s.ctx.db
      .prepare('SELECT outcome FROM audit_events WHERE action = ?')
      .all(action) as { outcome: string }[]
  ).map((r) => r.outcome);

describe('POST /api/action with a key (#450)', () => {
  it('runs the same key once; both get the answer of the first, with the state of now', async () => {
    const s = await anna();
    const build = () =>
      s.call(
        'POST',
        '/api/action',
        { type: 'build', key: 'metal' },
        {
          [KEY]: 'k-build',
        },
      );
    const first = await build();
    expect(first.status).toBe(200);
    const paid = s.ctx.planets.home('u_Anna')!.res;
    const second = await build();
    expect(second.status).toBe(200);
    expect(second.json).toMatchObject({ ok: true });
    expect(
      (second.json as { state: { planet: { bq: unknown } } }).state.planet.bq,
    ).toMatchObject({ key: 'metal', lvl: 1 });
    // Paid once, one order, one audit entry.
    expect(s.ctx.planets.home('u_Anna')!.res).toEqual(paid);
    expect(audits(s, 'build')).toEqual(['ok']);
  });

  it('runs two keys twice, and a request without a key as before', async () => {
    const s = await anna();
    const rename = (name: string, key?: string) =>
      s.call(
        'POST',
        '/api/action',
        { type: 'rename', name },
        key ? { [KEY]: key } : {},
      );
    await rename('Eins', 'a');
    await rename('Zwei', 'b');
    expect(s.ctx.planets.home('u_Anna')!.name).toBe('Zwei');
    await rename('Drei');
    await rename('Vier');
    expect(audits(s, 'rename')).toEqual(['ok', 'ok', 'ok', 'ok']);
  });

  it('runs an invalid key as a request without one', async () => {
    const s = await anna();
    for (const name of ['Eins', 'Zwei'])
      await s.call(
        'POST',
        '/api/action',
        { type: 'rename', name },
        { [KEY]: 'not a key' },
      );
    expect(audits(s, 'rename')).toEqual(['ok', 'ok']);
  });

  it('runs a key again after its time', async () => {
    const s = await anna();
    const rename = (name: string) =>
      s.call('POST', '/api/action', { type: 'rename', name }, { [KEY]: 'k' });
    await rename('Eins');
    s.ctx.clock.t += KEPT_MS;
    await rename('Zwei');
    expect(s.ctx.planets.home('u_Anna')!.name).toBe('Zwei');
  });

  it('gives a refusal again, without running it a second time', async () => {
    const s = await anna();
    const refused = () =>
      s.call(
        'POST',
        '/api/action',
        { type: 'rename', name: '' },
        {
          [KEY]: 'k-refused',
        },
      );
    const first = await refused();
    const second = await refused();
    expect(first.status).toBe(400);
    expect(second).toMatchObject({ status: 400, json: first.json });
    expect(audits(s, 'rename')).toEqual(['rejected']);
  });

  it('keeps the field `key` of an action apart from the header (pct)', async () => {
    const s = await anna();
    const pct = (v: number) =>
      s.call(
        'POST',
        '/api/action',
        { type: 'pct', key: 'metal', v },
        {
          [KEY]: 'metal',
        },
      );
    await pct(50);
    expect(s.ctx.planets.home('u_Anna')!.pct.metal).toBe(50);
    // The same header key again: not run, though the body differs.
    await pct(30);
    expect(s.ctx.planets.home('u_Anna')!.pct.metal).toBe(50);
    // A new header key with the same body field runs.
    await s.call(
      'POST',
      '/api/action',
      { type: 'pct', key: 'metal', v: 30 },
      {
        [KEY]: 'other',
      },
    );
    expect(s.ctx.planets.home('u_Anna')!.pct.metal).toBe(30);
  });

  it('never gives one player the answer of another', async () => {
    const s = await anna();
    await s.call(
      'POST',
      '/api/action',
      { type: 'rename', name: 'Anna1' },
      {
        [KEY]: 'shared',
      },
    );
    addUser(s.ctx, 'Bert');
    addPlanet(s.ctx, 'u_Bert', { g: 1, s: 3, p: 4 });
    await s.call('POST', '/api/logout', {});
    await s.call('POST', '/api/login', { name: 'bert', password: 'secret1' });
    await s.call(
      'POST',
      '/api/action',
      { type: 'rename', name: 'Bert1' },
      {
        [KEY]: 'shared',
      },
    );
    expect(s.ctx.planets.home('u_Bert')!.name).toBe('Bert1');
  });

  it('does not count a repeat against the limit of actions (6A)', async () => {
    const s = await anna();
    const rename = (key: string) =>
      s.call(
        'POST',
        '/api/action',
        { type: 'rename', name: 'Heim' },
        {
          [KEY]: key,
        },
      );
    // The first run counts once; its repeats count nothing.
    for (let i = 0; i <= ACTIONS_PER_MINUTE; i++)
      expect((await rename('same')).status).toBe(200);
    // So the limit still has room for the rest of the minute.
    for (let i = 1; i < ACTIONS_PER_MINUTE; i++)
      expect((await rename(`k${i}`)).status, `k${i}`).toBe(200);
    expect((await rename('one-too-many')).json).toEqual({
      error: 'Zu viele Aktionen in kurzer Zeit. Bitte warte einen Moment.',
    });
  });

  it('needs a session before a key is looked at', async () => {
    const s = await start();
    const out = await s.call(
      'POST',
      '/api/action',
      { type: 'rename' },
      {
        [KEY]: 'k',
      },
    );
    expect(out.status).toBe(401);
  });
});

describe('an admin write with a key (#450)', () => {
  it('sends a server message once for the same key', async () => {
    const s = await asAdmin();
    addUser(s.ctx, 'Pilot');
    addPlanet(s.ctx, 'u_Pilot', { g: 1, s: 4, p: 4 });
    const announce = () =>
      s.call(
        'POST',
        '/api/admin/announce',
        { message: 'Hallo' },
        {
          [KEY]: 'k-announce',
        },
      );
    const first = await announce();
    const second = await announce();
    expect(first.json).toEqual({ recipients: 2 });
    expect(second.json).toEqual(first.json);
    expect(s.ctx.reports.ofPlayer('u_Pilot')).toHaveLength(1);
    await s.call(
      'POST',
      '/api/admin/announce',
      { message: 'Hallo' },
      {
        [KEY]: 'k-other',
      },
    );
    expect(s.ctx.reports.ofPlayer('u_Pilot')).toHaveLength(2);
  });
});
