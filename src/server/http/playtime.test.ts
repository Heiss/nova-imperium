// The routes of the estimated play time (#232, #231): reports and the
// player's own statistics.
import { describe, expect, it, vi } from 'vitest';
import { start } from '../../test/http.ts';
import { addPlanet, addUser } from '../test-helpers.ts';

// The password check is the cost of every login here; the result of the same
// password and salt is computed once (src/test/scrypt-memo.ts).
vi.mock('node:crypto', async (original) =>
  (await import('../../test/scrypt-memo.ts')).memoScrypt(
    await original<typeof import('node:crypto')>(),
  ),
);

const report = (seq: number, since: number | null, state = 'active') => ({
  instance: 'page-0001',
  seq,
  state,
  since,
});

async function twoPlayers() {
  const s = await start();
  addUser(s.ctx, 'Anna');
  addPlanet(s.ctx, 'u_Anna');
  addUser(s.ctx, 'Bert');
  addPlanet(s.ctx, 'u_Bert', { p: 6 });
  const login = async (name: string) =>
    (
      await s.call('POST', '/api/login', { name, password: 'secret1' })
    ).set!.split(';')[0]!;
  return { ...s, anna: await login('Anna'), bert: await login('Bert') };
}

describe('POST /api/playtime and GET /api/own-activity', () => {
  it('need a session', async () => {
    const { call } = await start();
    expect((await call('POST', '/api/playtime', report(0, null))).status).toBe(
      401,
    );
    expect((await call('GET', '/api/own-activity')).status).toBe(401);
  });

  it('record the reports of the signed-in player and show only their own time', async () => {
    const { ctx, call, setCookie, anna, bert } = await twoPlayers();
    setCookie(anna);
    expect((await call('POST', '/api/playtime', report(0, null))).json).toEqual(
      {
        ok: true,
      },
    );
    ctx.clock.t += 30_000;
    await call('POST', '/api/playtime', report(1, 30_000));
    // A body naming another player changes nothing: the account is the session's.
    ctx.clock.t += 10_000;
    await call('POST', '/api/playtime', {
      ...report(2, 10_000, 'inactive'),
      player: 'u_Bert',
      user_id: 'u_Bert',
    });
    const own = (await call('GET', '/api/own-activity?player=u_Bert')).json!;
    expect(own).toMatchObject({
      method: 1,
      since: expect.any(Number),
      roundMs: 40_000,
      totalMs: 40_000,
    });
    expect((own.days as { activeMs: number }[])[0]).toMatchObject({
      activeMs: 40_000,
    });
    setCookie(bert);
    expect(
      (await call('GET', '/api/own-activity?player=u_Anna')).json,
    ).toMatchObject({ since: null, roundMs: 0, totalMs: 0 });
    expect(
      ctx.db
        .prepare('SELECT DISTINCT user_id FROM playtime_events')
        .pluck()
        .all(),
    ).toEqual(['u_Anna']);
  });

  it('refuse a report that is none, with a message and nothing stored', async () => {
    const { ctx, call, setCookie, anna } = await twoPlayers();
    setCookie(anna);
    const refused = await call('POST', '/api/playtime', { instance: 'x' });
    expect(refused.status).toBe(400);
    expect(refused.json).toEqual({ error: 'Ungültige Meldung.' });
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM playtime_events').pluck().get(),
    ).toBe(0);
  });

  it('set no public activity and write no audit entry, however often a page reports (#229)', async () => {
    const { ctx, call, setCookie, anna } = await twoPlayers();
    setCookie(anna);
    const marked = { ...ctx.planets.activeTimes() };
    const last = ctx.players.lastActive().u_Anna;
    const audits = ctx.db
      .prepare('SELECT COUNT(*) FROM audit_events')
      .pluck()
      .get();
    await call('POST', '/api/playtime', report(0, null));
    for (let i = 1; i <= 5; i++) {
      ctx.clock.t += 30_000;
      await call('POST', '/api/playtime', report(i, 30_000));
    }
    expect(ctx.planets.activeTimes()).toEqual(marked);
    expect(ctx.players.lastActive().u_Anna).toBe(last);
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM audit_events').pluck().get(),
    ).toBe(audits);
  });

  it('record nothing for an account in vacation mode', async () => {
    const { ctx, call, setCookie, anna } = await twoPlayers();
    setCookie(anna);
    ctx.db
      .prepare('UPDATE users SET vacation = ? WHERE id = ?')
      .run(ctx.now(), 'u_Anna');
    expect((await call('POST', '/api/playtime', report(0, null))).json).toEqual(
      {
        ok: true,
      },
    );
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM playtime_events').pluck().get(),
    ).toBe(0);
  });
});
