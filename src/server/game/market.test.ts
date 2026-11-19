// The exchange on the server (#171): one transaction, the refusals with
// their words, the price that all players share and that drifts back, the
// limit per UTC day, the cap by the free storage, a new round that starts
// over, and the state the browser previews from.
import { describe, expect, it } from 'vitest';
import { DAY_MS, HOUR_MS, dayOf, priceAfter } from '../../core/market.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, type TestCtx, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { currentPrices, marketOf } from './market.ts';
import { stateFor } from './state.ts';

// 2026-11-18 12:00 UTC.
const START = Date.UTC(2026, 10, 18, 12, 0);
const BASE = 1_000_000;

/** Anna and Bert, each with a planet with a Handelsposten of level 1 and 5,000 Adamant. */
function world(): TestCtx {
  const ctx = testCtx(START);
  addUser(ctx, 'Anna', { admin: true });
  addUser(ctx, 'Bert');
  for (const [owner, p] of [
    ['u_Anna', 5],
    ['u_Bert', 6],
  ] as const)
    addPlanet(ctx, owner, {
      p,
      b: { market: 1, robot: 4 },
      res: { m: 5000, c: 100, d: 0 },
    });
  return ctx;
}

const trade = (
  ctx: TestCtx,
  over: Record<string, unknown> = {},
  event?: AuditEntry,
  uid = 'u_Anna',
) =>
  runAction(
    ctx,
    uid,
    {
      type: 'trade',
      give: 'm',
      get: 'c',
      amount: 1000,
      planet: uid === 'u_Anna' ? 'p1_1_5' : 'p1_1_6',
      ...over,
    },
    event,
  );

const stock = (ctx: TestCtx, id = 'p1_1_5') => ctx.planets.get(id)!.res;
const refusal = (fn: () => unknown): string => {
  try {
    fn();
  } catch (error) {
    return (error as Error).message;
  }
  return 'no refusal';
};

describe('the action trade', () => {
  it('exchanges at the ratio with the fee of the level, in whole units, and says so', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      res: { m: 5000.7, c: 100.25, d: 0 },
    });
    const event: AuditEntry = { category: 'game', action: 'trade' };
    expect(trade(ctx, {}, event)).toBe(
      '1.000 Adamant gegen 450 Psikristall getauscht.',
    );
    expect(stock(ctx)).toEqual({ m: 4000.7, c: 550.25, d: 0 });
    expect(event.detail).toEqual({
      planet: 'p1_1_5',
      give: 'm',
      get: 'c',
      given: 1000,
      got: 450,
      fee: 50,
      capped: false,
      cut: false,
      price: BASE,
    });
  });

  it('lowers the price of the pair by a share of the amount and counts the amount of the day', () => {
    const ctx = world();
    trade(ctx);
    expect(priceAfter(BASE, 1000, 5)).toBe(995024);
    expect(ctx.market.prices()).toEqual({ mc: { price: 995024, at: START } });
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(1000);
    // The next exchange of the pair is made at the lower price.
    expect(trade(ctx)).toBe('1.000 Adamant gegen 447 Psikristall getauscht.');
    expect(ctx.market.prices().mc!.price).toBe(priceAfter(995024, 1000, 5));
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(2000);
  });

  it('leaves the other pairs at their price, and shares the price among players', () => {
    const ctx = world();
    trade(ctx);
    expect(currentPrices(ctx)).toEqual({
      mc: 995024,
      md: BASE,
      cm: BASE,
      cd: BASE,
      dm: BASE,
      dc: BASE,
    });
    expect(trade(ctx, {}, undefined, 'u_Bert')).toBe(
      '1.000 Adamant gegen 447 Psikristall getauscht.',
    );
    expect(ctx.market.used('u_Bert', dayOf(START))).toBe(1000);
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(1000);
  });

  it('lets the price drift back in a straight line over the drift time of the round', () => {
    const ctx = world();
    trade(ctx);
    ctx.clock.t += 12 * HOUR_MS;
    expect(currentPrices(ctx).mc).toBe(997512);
    ctx.clock.t += 12 * HOUR_MS;
    expect(currentPrices(ctx).mc).toBe(BASE);
  });

  it('drifts for the hours the admin sets, also changed during the round', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketDrift', 48]]);
    trade(ctx);
    ctx.clock.t += 24 * HOUR_MS;
    expect(currentPrices(ctx).mc).toBe(997512);
    ctx.admin.putSettings([['roundMarketDrift', 24]]);
    expect(currentPrices(ctx).mc).toBe(BASE);
  });

  it('shifts the price by the step of the round', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketStep', 100]]);
    trade(ctx);
    expect(ctx.market.prices().mc!.price).toBe(priceAfter(BASE, 1000, 100));
    expect(ctx.market.prices().mc!.price).toBe(909090);
  });

  it('uses the ratios of the admin, changed during the round', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketMc', 800]]);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 720 Psikristall getauscht.');
    ctx.admin.putSettings([['roundMarketCm', 4000]]);
    expect(trade(ctx, { give: 'c', get: 'm', amount: 100 })).toBe(
      '100 Psikristall gegen 360 Adamant getauscht.',
    );
  });

  it('takes the fee of the level of the Handelsposten on the planet', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      b: { market: 11 },
    });
    expect(trade(ctx)).toBe('1.000 Adamant gegen 500 Psikristall getauscht.');
  });

  it('takes the fee from the two settings of the round, never below 0 (owner, 2026-11-19)', () => {
    const ctx = world();
    const level = (n: number) =>
      ctx.planets.save({
        ...ctx.planets.get('p1_1_5')!,
        b: { market: n },
        res: { m: 5000, c: 100, d: 0 },
      });
    ctx.admin.putSettings([
      ['roundMarketFee', 20],
      ['roundMarketFeeStep', 5],
    ]);
    level(1);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 400 Psikristall getauscht.');
    ctx.market.clear();
    level(3);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 450 Psikristall getauscht.');
    ctx.market.clear();
    level(5);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 500 Psikristall getauscht.');
    ctx.market.clear();
    level(9);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 500 Psikristall getauscht.');
    ctx.admin.putSettings([
      ['roundMarketFee', 0],
      ['roundMarketFeeStep', 0],
    ]);
    ctx.market.clear();
    level(1);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 500 Psikristall getauscht.');
    ctx.admin.putSettings([['roundMarketFee', 100]]);
    ctx.market.clear();
    level(1);
    expect(refusal(() => trade(ctx))).toBe(
      'Für diese Menge bekommst du nichts.',
    );
  });

  it('exchanges all six pairs', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      res: { m: 9000, c: 9000, d: 9000 },
    });
    const say = (give: string, get: string) =>
      trade(ctx, { give, get, amount: 1000 });
    expect(say('m', 'd')).toBe('1.000 Adamant gegen 225 Promethium getauscht.');
    expect(say('c', 'm')).toBe(
      '1.000 Psikristall gegen 1.800 Adamant getauscht.',
    );
    expect(say('c', 'd')).toBe(
      '1.000 Psikristall gegen 450 Promethium getauscht.',
    );
    expect(say('d', 'm')).toBe(
      '1.000 Promethium gegen 3.600 Adamant getauscht.',
    );
    expect(say('d', 'c')).toBe(
      '1.000 Promethium gegen 1.800 Psikristall getauscht.',
    );
  });
});

describe('the refusals of trade', () => {
  it('refuses every exchange while the marketplace is off in the round (D6)', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketOn', 0]]);
    expect(refusal(() => trade(ctx))).toBe(
      'Der Marktplatz ist in dieser Runde geschlossen.',
    );
    ctx.admin.putSettings([['roundMarketOn', 1]]);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 450 Psikristall getauscht.');
  });

  it('refuses without a Handelsposten on the planet', () => {
    const ctx = world();
    ctx.planets.save({ ...ctx.planets.get('p1_1_5')!, b: { robot: 4 } });
    expect(refusal(() => trade(ctx))).toBe(
      'Auf diesem Planeten fehlt ein Handelsposten.',
    );
  });

  it('refuses a planet that is not the player’s, and a resource that is no resource', () => {
    const ctx = world();
    expect(refusal(() => trade(ctx, { planet: 'p1_1_6' }))).toBe(
      'Du hast keinen Zugriff auf diesen Planeten.',
    );
    for (const bad of [
      { get: 'e' },
      { give: 'e' },
      { get: 'm' },
      { give: undefined },
    ])
      expect(
        refusal(() => trade(ctx, bad)),
        JSON.stringify(bad),
      ).toBe('Diese Rohstoffe lassen sich nicht tauschen.');
  });

  it('refuses an amount that is not a whole number of at least 1, or more than the planet has', () => {
    const ctx = world();
    for (const amount of [0, -1, 1.5, '1000', null])
      expect(
        refusal(() => trade(ctx, { amount })),
        String(amount),
      ).toBe('Bitte eine ganze Menge von mindestens 1 angeben.');
    expect(refusal(() => trade(ctx, { amount: 5001 }))).toBe(
      'So viel hast du auf diesem Planeten nicht.',
    );
  });

  it('changes nothing when it refuses', () => {
    const ctx = world();
    const before = [
      ctx.db.prepare('SELECT * FROM planets ORDER BY id').all(),
      ctx.market.prices(),
      ctx.market.used('u_Anna', dayOf(START)),
    ];
    for (const bad of [{ amount: 9999 }, { get: 'e' }, { amount: 0 }])
      refusal(() => trade(ctx, bad));
    expect([
      ctx.db.prepare('SELECT * FROM planets ORDER BY id').all(),
      ctx.market.prices(),
      ctx.market.used('u_Anna', dayOf(START)),
    ]).toEqual(before);
  });

  it('is atomic: a failure after the stock changed leaves stock, price and amount as they were', () => {
    const ctx = world();
    const real = ctx.market.addUsed.bind(ctx.market);
    ctx.market.addUsed = () => {
      throw new Error('disk full');
    };
    expect(() => trade(ctx)).toThrow('disk full');
    ctx.market.addUsed = real;
    expect(stock(ctx)).toEqual({ m: 5000, c: 100, d: 0 });
    expect(ctx.market.prices()).toEqual({});
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(0);
  });
});

describe('the limit per player per day (D5)', () => {
  it('cuts what is over the limit of the round to what is left and says so (owner, 2026-11-19)', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketLimit', 1500]]);
    expect(trade(ctx)).toBe('1.000 Adamant gegen 450 Psikristall getauscht.');
    const event: AuditEntry = { category: 'game', action: 'trade' };
    expect(trade(ctx, { amount: 600 }, event)).toBe(
      '500 Adamant gegen 223 Psikristall getauscht. Tageslimit erreicht: Es wurden nur 500 Adamant getauscht.',
    );
    expect(event.detail).toMatchObject({
      given: 500,
      got: 223,
      capped: false,
      cut: true,
    });
    expect(stock(ctx).m).toBe(3500);
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(1500);
    expect(refusal(() => trade(ctx, { amount: 1 }))).toBe(
      'Tageslimit erreicht: Heute kannst du noch 0 tauschen.',
    );
  });

  it('has no limit with a limit of 0', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketLimit', 0]]);
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      res: { m: 50_000, c: 0, d: 0 },
    });
    expect(trade(ctx, { amount: 20_000 })).toMatch(/^20\.000 Adamant gegen/);
    expect(trade(ctx, { amount: 20_000 })).not.toContain('Tageslimit');
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(40_000);
  });

  it('counts all resources together and each player apart', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketLimit', 1500]]);
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      res: { m: 5000, c: 1000, d: 0 },
    });
    trade(ctx);
    expect(trade(ctx, { give: 'c', get: 'm', amount: 600 })).toBe(
      '500 Psikristall gegen 900 Adamant getauscht. Tageslimit erreicht: Es wurden nur 500 Psikristall getauscht.',
    );
    // Bert pays the price Anna's exchange of the same pair left.
    expect(trade(ctx, {}, undefined, 'u_Bert')).toBe(
      '1.000 Adamant gegen 447 Psikristall getauscht.',
    );
  });

  it('names the limit when it is smaller than the storage, the storage when that is', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      res: { m: 5000, c: 99_700.5, d: 0 },
    });
    ctx.admin.putSettings([['roundMarketLimit', 500]]);
    expect(trade(ctx)).toBe(
      '500 Adamant gegen 225 Psikristall getauscht. Tageslimit erreicht: Es wurden nur 500 Adamant getauscht.',
    );
    ctx.admin.putSettings([['roundMarketLimit', 100_000]]);
    expect(trade(ctx, { amount: 1000 })).toMatch(
      /Das Lager für Psikristall ist jetzt voll\.$/,
    );
  });

  it('starts over at the next UTC day, not 24 hours after the first exchange', () => {
    const ctx = world();
    ctx.admin.putSettings([['roundMarketLimit', 1000]]);
    trade(ctx);
    ctx.clock.t = Date.UTC(2026, 10, 18, 23, 59, 59);
    expect(refusal(() => trade(ctx, { amount: 1 }))).toBe(
      'Tageslimit erreicht: Heute kannst du noch 0 tauschen.',
    );
    ctx.clock.t = Date.UTC(2026, 10, 19, 0, 0, 0);
    expect(dayOf(ctx.now())).toBe(dayOf(START) + 1);
    expect(trade(ctx, { amount: 1000 })).toMatch(/^1\.000 Adamant gegen/);
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(0);
    expect(ctx.market.used('u_Anna', dayOf(START) + 1)).toBe(1000);
    expect(DAY_MS).toBe(86_400_000);
  });
});

describe('the free storage (D4)', () => {
  it('caps the result and takes only the amount that gives it', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      res: { m: 5000, c: 99_700.5, d: 0 },
    });
    const event: AuditEntry = { category: 'game', action: 'trade' };
    expect(trade(ctx, {}, event)).toBe(
      '665 Adamant gegen 299 Psikristall getauscht. Das Lager für Psikristall ist jetzt voll.',
    );
    expect(stock(ctx)).toEqual({ m: 4335, c: 99_999.5, d: 0 });
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(665);
    expect(ctx.market.prices().mc!.price).toBe(priceAfter(BASE, 665, 5));
    expect(event.detail).toMatchObject({
      given: 665,
      got: 299,
      fee: 33,
      capped: true,
    });
  });

  it('refuses when the target storage is full', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      res: { m: 5000, c: 100_000, d: 0 },
    });
    expect(refusal(() => trade(ctx))).toBe(
      'Das Lager für Psikristall ist voll.',
    );
  });

  it('uses the storage of the planet: a store of the Psikristall-Reliquiar raises the room', () => {
    const ctx = world();
    ctx.planets.save({
      ...ctx.planets.get('p1_1_5')!,
      b: { market: 1, scrystal: 1 },
      res: { m: 5000, c: 100_000, d: 0 },
    });
    expect(trade(ctx)).toBe('1.000 Adamant gegen 450 Psikristall getauscht.');
  });
});

describe('a new round and the state', () => {
  it('forgets the prices and the amounts of the day with the new round, and keeps the settings', () => {
    const ctx = world();
    trade(ctx);
    expect(Object.keys(ctx.market.prices())).toEqual(['mc']);
    runAction(ctx, 'u_Anna', {
      type: 'reset',
      market: {
        marketOn: 1,
        marketMc: 700,
        marketMd: 250,
        marketCm: 2000,
        marketCd: 500,
        marketDm: 4000,
        marketDc: 2000,
        marketStep: 5,
        marketDrift: 24,
        marketLimit: 100000,
        marketFee: 5,
        marketFeeStep: 2,
      },
    });
    expect(ctx.market.prices()).toEqual({});
    expect(ctx.market.used('u_Anna', dayOf(START))).toBe(0);
    expect(ctx.admin.setting('roundMarketMc')).toBe(700);
    expect(ctx.admin.setting('roundMarketFee')).toBe(5);
    expect(ctx.admin.setting('roundMarketFeeStep')).toBe(2);
  });

  it('sends the prices now and what the player gave today', () => {
    const ctx = world();
    trade(ctx);
    ctx.clock.t += 6 * HOUR_MS;
    const state = stateFor(ctx, ctx.players.get('u_Anna')!) as {
      market: unknown;
      round: Record<string, number>;
    };
    expect(state.market).toEqual({
      prices: {
        mc: 996268,
        md: BASE,
        cm: BASE,
        cd: BASE,
        dm: BASE,
        dc: BASE,
      },
      used: 1000,
    });
    // Yesterday's amount is not today's: it is 06:00 of the next UTC day.
    ctx.clock.t += 12 * HOUR_MS;
    const next = stateFor(ctx, ctx.players.get('u_Anna')!) as {
      market: { used: number };
    };
    expect(next.market.used).toBe(0);
    expect(state.round).toMatchObject({ marketOn: 1, marketMc: 500 });
  });

  it('builds the market of a planet for the browser and the action alike', () => {
    const ctx = world();
    const anna = ctx.players.get('u_Anna')!;
    const m = marketOf(ctx, anna, ctx.planets.get('p1_1_5')!);
    expect(m).toMatchObject({
      open: true,
      level: 1,
      stock: { m: 5000, c: 100, d: 0 },
      caps: { m: 100000, c: 100000, d: 100000 },
      used: 0,
      limit: 100000,
      ratios: { mc: 500, md: 250, cm: 2000, cd: 500, dm: 4000, dc: 2000 },
      feeBase: 10,
      feeStep: 1,
    });
  });
});
