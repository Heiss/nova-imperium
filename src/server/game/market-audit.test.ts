// The audit log of the marketplace (#171, acceptance criterion: changes of
// the market settings are in the audit log): an exchange is a game action
// with its amounts, a change of a setting and a new round record before and
// after values, and the state of the answer carries the prices.
import { describe, expect, it } from 'vitest';
import { asAdmin } from '../../test/http.ts';

type Detail = Record<string, unknown>;

const audit = (ctx: { db: import('../db/database.ts').Db }, action: string) =>
  (
    ctx.db
      .prepare(
        'SELECT category, outcome, detail FROM audit_events WHERE action = ? ORDER BY id',
      )
      .all(action) as { category: string; outcome: string; detail: string }[]
  ).map((r) => ({ ...r, detail: JSON.parse(r.detail) as Detail }));

describe('the marketplace in the audit log', () => {
  it('records an exchange as a game action with the planet, the pair and both amounts', async () => {
    const { ctx, call } = await asAdmin();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      b: { market: 1 },
      res: { m: 5000, c: 0, d: 0 },
    });
    const reply = await call('POST', '/api/action', {
      type: 'trade',
      give: 'm',
      get: 'c',
      amount: 1000,
      planet: 'p1_1_5',
    });
    expect(reply.json).toMatchObject({
      ok: true,
      msg: '1.000 Adamant gegen 450 Psikristall getauscht.',
      state: { market: { used: 1000 } },
    });
    expect(audit(ctx, 'trade')).toEqual([
      {
        category: 'game',
        outcome: 'ok',
        detail: {
          planet: 'p1_1_5',
          give: 'm',
          get: 'c',
          given: 1000,
          got: 450,
          fee: 50,
          capped: false,
          cut: false,
          price: 1_000_000,
        },
      },
    ]);
  });

  it('records a refused exchange as rejected, with the planet only', async () => {
    const { ctx, call } = await asAdmin();
    const reply = await call('POST', '/api/action', {
      type: 'trade',
      give: 'm',
      get: 'c',
      amount: 1,
    });
    expect(reply.json).toEqual({
      error: 'Auf diesem Planeten fehlt ein Handelsposten.',
    });
    expect(audit(ctx, 'trade')).toEqual([
      { category: 'game', outcome: 'rejected', detail: { planet: 'p1_1_5' } },
    ]);
  });

  it('records a change of the ratios, the step, the drift, the limit and the switch, with before and after', async () => {
    const { ctx, call } = await asAdmin();
    const before = ctx.admin.universe();
    const changed = {
      roundMarketOn: 0,
      roundMarketMc: 800,
      roundMarketDc: 1200,
      roundMarketStep: 20,
      roundMarketDrift: 12,
      roundMarketLimit: 5000,
      roundMarketFee: 15,
      roundMarketFeeStep: 3,
    };
    const reply = await call('POST', '/api/action', {
      type: 'settings',
      settings: { ...before, ...changed },
    });
    expect(reply.json).toMatchObject({ ok: true });
    const [row] = audit(ctx, 'settings');
    expect(row!.category).toBe('admin.write');
    const { before: was, after } = row!.detail as {
      before: Record<string, number>;
      after: Record<string, number>;
    };
    for (const [key, value] of Object.entries(changed)) {
      expect(was[key], key).toBe(before[key as keyof typeof before]);
      expect(after[key], key).toBe(value);
    }
    expect(was.roundMarketOn).toBe(1);
    expect(was.roundMarketMc).toBe(500);
  });

  it('refuses a wrong ratio of the live settings, nothing saved, every wrong one named', async () => {
    const { ctx, call } = await asAdmin();
    const before = ctx.admin.universe();
    const reply = await call('POST', '/api/action', {
      type: 'settings',
      settings: { ...before, roundMarketMc: 0, roundMarketLimit: 10_000_001 },
    });
    expect(reply.json).toEqual({
      error:
        'Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant): ganze Zahl von 1 bis 100000. Marktplatz Tageslimit je Spieler (Einheiten, 0 = unbegrenzt): ganze Zahl von 0 bis 10000000.',
    });
    expect(ctx.admin.universe()).toEqual(before);
    expect(audit(ctx, 'settings')[0]!.outcome).toBe('rejected');
  });

  it('records the values of the market in a new round, before and after', async () => {
    const { ctx, call } = await asAdmin();
    await call('POST', '/api/action', {
      type: 'reset',
      market: {
        marketOn: 0,
        marketMc: 700,
        marketMd: 250,
        marketCm: 2000,
        marketCd: 500,
        marketDm: 4000,
        marketDc: 2000,
        marketStep: 5,
        marketDrift: 24,
        marketLimit: 100000,
        marketFee: 10,
        marketFeeStep: 1,
      },
    });
    const [row] = audit(ctx, 'reset');
    const { before, after } = row!.detail as {
      before: Record<string, number>;
      after: Record<string, number>;
    };
    expect([before.marketOn, before.marketMc]).toEqual([1, 500]);
    expect([after.marketOn, after.marketMc]).toEqual([0, 700]);
  });
});
