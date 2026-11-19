// The marketplace (#171, okf/features/marketplace.md): the rules as exact
// values, the settings of the round as the registry holds them, and the
// property that no chain of exchanges gains resources (the acceptance
// criterion of the issue).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DAILY_LIMIT,
  DAY_MS,
  DEFAULT_RATIOS,
  DRIFT_HOURS,
  FEE,
  FEE_STEP,
  FEE_UNIT,
  HOUR_MS,
  PAIRS,
  PRICE_UNIT,
  RATIO_RANGE,
  RATIO_UNIT,
  RES_NAME,
  STEP,
  TRADED,
  type Market,
  type Pair,
  type PriceState,
  type Res,
  type Terms,
  dayOf,
  feeOf,
  feePercent,
  gainingTrips,
  got,
  givingFor,
  marketOpen,
  maxGive,
  pairOf,
  postLevel,
  priceAfter,
  priceNow,
  ratiosOf,
  remaining,
  roomFor,
  termsOf,
  trade,
} from './market.ts';
import {
  ROUND_SETTINGS,
  roundFieldId,
  roundRefused,
  roundRequest,
  roundValues,
} from './round.ts';
import { DEFAULT_UNIVERSE, liveSpecs, universeErrors } from './universe.ts';
import { roundDefaults } from '../test/fixtures.ts';

/** The base terms of an exchange at level 1: 500 per 1,000, the base price, a fee of 10 %. */
const T: Terms = { ratio: 500, price: 1_000_000, fee: 100 };

/** A market at level 1 with the default ratios, the base prices and room everywhere. */
function market(over: Partial<Market> = {}): Market {
  return {
    open: true,
    level: 1,
    stock: { m: 5000, c: 100, d: 0 },
    caps: { m: 100000, c: 100000, d: 100000 },
    ratios: DEFAULT_RATIOS,
    prices: { mc: 1e6, md: 1e6, cm: 1e6, cd: 1e6, dm: 1e6, dc: 1e6 },
    used: 0,
    limit: 100000,
    feeBase: 10,
    feeStep: 1,
    ...over,
  };
}

describe('the numbers of the marketplace [V]', () => {
  it('has the units, ranges and defaults the notes name', () => {
    expect([RATIO_UNIT, PRICE_UNIT, FEE_UNIT]).toEqual([1000, 1_000_000, 1000]);
    expect(RATIO_RANGE).toEqual({ min: 1, max: 100_000 });
    expect(STEP).toEqual({ min: 1, max: 1000, def: 5 });
    expect(DRIFT_HOURS).toEqual({ min: 1, max: 720, def: 24 });
    expect(DAILY_LIMIT).toEqual({ min: 0, max: 10_000_000, def: 100_000 });
    expect(FEE).toEqual({ min: 0, max: 100, def: 10 });
    expect(FEE_STEP).toEqual({ min: 0, max: 100, def: 1 });
    expect(HOUR_MS).toBe(3_600_000);
    expect(DAY_MS).toBe(86_400_000);
    expect(DEFAULT_RATIOS).toEqual({
      mc: 500,
      md: 250,
      cm: 2000,
      cd: 500,
      dm: 4000,
      dc: 2000,
    });
  });

  it('trades Adamant, Psikristall and Promethium, never energy', () => {
    expect(TRADED).toEqual(['m', 'c', 'd']);
    expect(RES_NAME).toEqual({
      m: 'Adamant',
      c: 'Psikristall',
      d: 'Promethium',
    });
    expect(PAIRS).toEqual(['mc', 'md', 'cm', 'cd', 'dm', 'dc']);
  });

  it('names the pair of two different resources only', () => {
    expect(pairOf('m', 'c')).toBe('mc');
    expect(pairOf('d', 'm')).toBe('dm');
    for (const bad of [
      ['m', 'm'],
      ['e', 'm'],
      ['m', 'e'],
      ['mc', 'd'],
      ['', 'c'],
      [undefined, 'c'],
      [null, null],
      [{}, 'c'],
      ['toString', 'm'],
    ])
      expect(pairOf(bad[0], bad[1]), String(bad)).toBeNull();
  });

  it('counts the limit per UTC day', () => {
    expect(dayOf(0)).toBe(0);
    expect(dayOf(DAY_MS - 1)).toBe(0);
    expect(dayOf(DAY_MS)).toBe(1);
    expect(dayOf(1_763_300_000_000)).toBe(20408);
  });
});

describe('the fee of the Handelsposten (owner, 2026-11-19)', () => {
  it('is the fee of level 1 and falls by the step per level, 10 % and 1 point by default', () => {
    expect(
      [1, 2, 3, 6, 10, 11].map((level) => feePercent(level, 10, 1)),
    ).toEqual([10, 9, 8, 5, 1, 0]);
    expect([1, 2, 3, 4, 5].map((level) => feePercent(level, 20, 5))).toEqual([
      20, 15, 10, 5, 0,
    ]);
  });

  it('never falls below 0', () => {
    expect([12, 50, 1000].map((level) => feePercent(level, 10, 1))).toEqual([
      0, 0, 0,
    ]);
    expect(feePercent(2, 10, 100)).toBe(0);
    expect(feePercent(3, 0, 5)).toBe(0);
  });

  it('stays the same on every level with a step of 0, and is 0 with a fee of 0', () => {
    expect([1, 7, 100].map((level) => feePercent(level, 12, 0))).toEqual([
      12, 12, 12,
    ]);
    expect(feePercent(1, 0, 0)).toBe(0);
    expect(feePercent(1, 100, 1)).toBe(100);
  });

  it('is read from the market: its level and the two values of the round', () => {
    expect(feeOf(market({ level: 1 }))).toBe(10);
    expect(feeOf(market({ level: 4 }))).toBe(7);
    expect(feeOf(market({ level: 4, feeBase: 30, feeStep: 10 }))).toBe(0);
    expect(feeOf(market({ level: 3, feeBase: 30, feeStep: 10 }))).toBe(10);
  });

  it('reads the level of the building on a planet, 0 without one', () => {
    expect(postLevel({ b: { market: 4, robot: 9 } })).toBe(4);
    expect(postLevel({ b: { robot: 9 } })).toBe(0);
  });
});

/** The ten settings of the round, as the registry holds them (the group `market`). */
const SETTINGS = ROUND_SETTINGS.filter((s) => s.group?.name === 'market');

describe('the settings of the round (#283, #310, X1)', () => {
  const group = { name: 'market', legend: 'Marktplatz' };
  const common = { kind: 'number', group, live: true };
  const ratio = { ...common, min: 1, max: 100000 };

  it('are twelve settings in one fieldset „Marktplatz“, in the order 320 to 430, all live', () => {
    expect(SETTINGS).toEqual([
      {
        ...common,
        key: 'roundMarketOn',
        name: 'marketOn',
        label: 'Marktplatz aktiv',
        order: 320,
        min: 0,
        max: 1,
        def: 1,
        choices: [
          { value: 1, label: 'Ja' },
          { value: 0, label: 'Nein' },
        ],
      },
      {
        ...ratio,
        key: 'roundMarketMc',
        name: 'marketMc',
        label:
          'Marktplatz Adamant → Psikristall (Psikristall je 1.000 Adamant)',
        order: 330,
        def: 500,
      },
      {
        ...ratio,
        key: 'roundMarketMd',
        name: 'marketMd',
        label: 'Marktplatz Adamant → Promethium (Promethium je 1.000 Adamant)',
        order: 340,
        def: 250,
      },
      {
        ...ratio,
        key: 'roundMarketCm',
        name: 'marketCm',
        label:
          'Marktplatz Psikristall → Adamant (Adamant je 1.000 Psikristall)',
        order: 350,
        def: 2000,
      },
      {
        ...ratio,
        key: 'roundMarketCd',
        name: 'marketCd',
        label:
          'Marktplatz Psikristall → Promethium (Promethium je 1.000 Psikristall)',
        order: 360,
        def: 500,
      },
      {
        ...ratio,
        key: 'roundMarketDm',
        name: 'marketDm',
        label: 'Marktplatz Promethium → Adamant (Adamant je 1.000 Promethium)',
        order: 370,
        def: 4000,
      },
      {
        ...ratio,
        key: 'roundMarketDc',
        name: 'marketDc',
        label:
          'Marktplatz Promethium → Psikristall (Psikristall je 1.000 Promethium)',
        order: 380,
        def: 2000,
      },
      {
        ...common,
        key: 'roundMarketStep',
        name: 'marketStep',
        label:
          'Marktplatz Preisschritt (Promille je 1.000 getauschte Einheiten)',
        order: 390,
        min: 1,
        max: 1000,
        def: 5,
      },
      {
        ...common,
        key: 'roundMarketDrift',
        name: 'marketDrift',
        label: 'Marktplatz Preiserholung (Stunden)',
        order: 400,
        min: 1,
        max: 720,
        def: 24,
      },
      {
        ...common,
        key: 'roundMarketLimit',
        name: 'marketLimit',
        label: 'Marktplatz Tageslimit je Spieler (Einheiten, 0 = unbegrenzt)',
        order: 410,
        min: 0,
        max: 10000000,
        def: 100000,
      },
      {
        ...common,
        key: 'roundMarketFee',
        name: 'marketFee',
        label: 'Marktplatz Gebühr auf Stufe 1 des Handelspostens (Prozent)',
        order: 420,
        min: 0,
        max: 100,
        def: 10,
      },
      {
        ...common,
        key: 'roundMarketFeeStep',
        name: 'marketFeeStep',
        label: 'Marktplatz Gebühr sinkt je weitere Stufe um (Prozentpunkte)',
        order: 430,
        min: 0,
        max: 100,
        def: 1,
      },
    ]);
  });

  it('share one group object, so the request holds one object `market`', () => {
    expect(new Set(SETTINGS.map((s) => s.group)).size).toBe(1);
    const request = roundRequest(roundDefaults());
    expect(request.market).toEqual({
      marketOn: 1,
      marketMc: 500,
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
    });
    expect(request).not.toHaveProperty('marketOn');
  });

  it('have the field ids of their names', () => {
    expect(SETTINGS.map(roundFieldId)).toEqual([
      'round-market-on',
      'round-market-mc',
      'round-market-md',
      'round-market-cm',
      'round-market-cd',
      'round-market-dm',
      'round-market-dc',
      'round-market-step',
      'round-market-drift',
      'round-market-limit',
      'round-market-fee',
      'round-market-fee-step',
    ]);
  });

  it('are on in a new round and in a universe that never set them (D6)', () => {
    expect(roundDefaults().marketOn).toBe(1);
    expect(DEFAULT_UNIVERSE.roundMarketOn).toBe(1);
    expect(DEFAULT_UNIVERSE.roundMarketLimit).toBe(100000);
    expect(DEFAULT_UNIVERSE.roundMarketFee).toBe(10);
    expect(DEFAULT_UNIVERSE.roundMarketFeeStep).toBe(1);
  });

  it('are rows of the universe settings, changed during the round (X1)', () => {
    const rows = liveSpecs().filter((s) => s.key.startsWith('roundMarket'));
    expect(rows.map((s) => s.key)).toEqual(SETTINGS.map((s) => s.key));
    expect(rows[0]).toEqual({
      key: 'roundMarketOn',
      label: 'Marktplatz aktiv',
      min: 0,
      max: 1,
      def: 1,
      choices: [
        { value: 1, label: 'Ja' },
        { value: 0, label: 'Nein' },
      ],
    });
  });

  it('are refused together with the range wording, every wrong one at once', () => {
    const current = roundDefaults();
    const sent = roundRequest(roundDefaults()).market as Record<string, number>;
    const data = {
      market: { ...sent, marketOn: 2, marketMc: 0, marketLimit: 10_000_001 },
    };
    const wrong = roundRefused(current, data);
    expect(wrong.map((s) => s.name)).toEqual([
      'marketOn',
      'marketMc',
      'marketLimit',
    ]);
    // A member that is not sent in a sent group is wrong: it must be sent.
    expect(roundRefused(current, { market: {} })).toHaveLength(12);
    // Nothing sent keeps the current values.
    expect(roundRefused(current, {})).toEqual([]);
    const ok = roundValues(current, {
      market: { ...roundDefaults(), marketMc: 700, marketOn: 0 },
    });
    expect(ok.marketMc).toBe(700);
    expect(ok.marketOn).toBe(0);
    expect(ok.marketCm).toBe(2000);
  });

  it('take the ends of their ranges and nothing beyond', () => {
    const live = Object.fromEntries(
      liveSpecs().map((s) => [s.key, s.def]),
    ) as Record<string, number>;
    const check = (key: string, value: number) =>
      universeErrors(
        { ...DEFAULT_UNIVERSE, ...live, [key]: value },
        {
          g: 1,
          s: 1,
          p: 1,
        },
      ).map((e) => e.spec.key);
    for (const [key, min, max] of [
      ['roundMarketOn', 0, 1],
      ['roundMarketMc', 1, 100000],
      ['roundMarketDc', 1, 100000],
      ['roundMarketStep', 1, 1000],
      ['roundMarketDrift', 1, 720],
      ['roundMarketLimit', 0, 10000000],
      ['roundMarketFee', 0, 100],
      ['roundMarketFeeStep', 0, 100],
    ] as const) {
      expect(check(key, min), key).toEqual([]);
      expect(check(key, max), key).toEqual([]);
      expect(check(key, min - 1), key).toEqual([key]);
      expect(check(key, max + 1), key).toEqual([key]);
    }
  });

  it('are read as the rules of the round: on is 1 only', () => {
    expect(marketOpen({ marketOn: 1 })).toBe(true);
    expect(marketOpen({ marketOn: 0 })).toBe(false);
    expect(
      ratiosOf({
        marketOn: 1,
        marketMc: 1,
        marketMd: 2,
        marketCm: 3,
        marketCd: 4,
        marketDm: 5,
        marketDc: 6,
        marketStep: 5,
        marketDrift: 24,
        marketLimit: 1,
        marketFee: 7,
        marketFeeStep: 2,
      }),
    ).toEqual({ mc: 1, md: 2, cm: 3, cd: 4, dm: 5, dc: 6 });
  });
});

describe('the warning about a round trip that gains (D2)', () => {
  it('finds no trip in the default ratios, which follow the values 1, 2 and 4 and return every round trip exactly', () => {
    expect(gainingTrips(DEFAULT_RATIOS)).toEqual([]);
  });

  it('does not call a trip that returns exactly what it started with a gain', () => {
    expect(
      gainingTrips({ mc: 500, cm: 2000, md: 250, dm: 4000, cd: 500, dc: 2000 }),
    ).toEqual([]);
  });

  it('names the trip through two resources whose ratios multiply to more than one', () => {
    expect(gainingTrips({ ...DEFAULT_RATIOS, mc: 501 })).toContainEqual([
      'm',
      'c',
    ]);
    expect(gainingTrips({ ...DEFAULT_RATIOS, cd: 667 })).toEqual([
      ['c', 'd'],
      ['m', 'c', 'd'],
    ]);
    expect(gainingTrips({ ...DEFAULT_RATIOS, md: 334 })).toContainEqual([
      'm',
      'd',
    ]);
  });

  it('names the trip through three resources in the direction it gains', () => {
    // 501 · 666 · 3000 is above 1,000³, the other direction is not.
    expect(gainingTrips({ ...DEFAULT_RATIOS, mc: 501 })).toEqual([
      ['m', 'c'],
      ['m', 'c', 'd'],
    ]);
    expect(gainingTrips({ ...DEFAULT_RATIOS, md: 334 })).toEqual([
      ['m', 'd'],
      ['m', 'd', 'c'],
    ]);
    expect(
      gainingTrips({ mc: 1000, cd: 1000, dm: 1001, md: 1, dc: 1, cm: 1 }),
    ).toEqual([['m', 'c', 'd']]);
  });

  it('is right: at a warned trip an exchange chain gains, at fee 0 and the base price', () => {
    const ratios = { ...DEFAULT_RATIOS, mc: 501 };
    const there = got(2000, { ratio: ratios.mc, price: 1e6, fee: 0 });
    const back = got(there, { ratio: ratios.cm, price: 1e6, fee: 0 });
    expect(there).toBe(1002);
    expect(back).toBe(2004);
  });
});

describe('the price of a pair', () => {
  const state = (price: number): PriceState => ({ price, at: 0 });

  it('is the base without a state', () => {
    expect(priceNow(undefined, 5 * HOUR_MS, 24)).toBe(1_000_000);
  });

  it('is the stored price right after the exchange', () => {
    expect(priceNow(state(600000), 0, 24)).toBe(600000);
    expect(priceNow(state(600000), -5, 24)).toBe(600000);
  });

  it('drifts back in a straight line over the drift time', () => {
    expect(priceNow(state(600000), 6 * HOUR_MS, 24)).toBe(700000);
    expect(priceNow(state(600000), 12 * HOUR_MS, 24)).toBe(800000);
    expect(priceNow(state(600000), 18 * HOUR_MS, 24)).toBe(900000);
    expect(priceNow(state(600000), 12 * HOUR_MS, 48)).toBe(700000);
  });

  it('is back at the base at the end of the drift time and stays there', () => {
    expect(priceNow(state(600000), 24 * HOUR_MS, 24)).toBe(1_000_000);
    expect(priceNow(state(600000), 100 * HOUR_MS, 24)).toBe(1_000_000);
    expect(priceNow(state(0), 24 * HOUR_MS, 24)).toBe(1_000_000);
  });

  it('rounds the part that is back down, one millisecond before the end it is below the base', () => {
    expect(priceNow(state(600000), 24 * HOUR_MS - 1, 24)).toBe(999999);
    expect(priceNow(state(999999), 24 * HOUR_MS - 1, 24)).toBe(999999);
    expect(priceNow({ price: 0, at: 1000 }, 1000 + 3600, 1)).toBe(1000);
    expect(priceNow({ price: 0, at: 1000 }, 1001, 1)).toBe(0);
  });

  it('falls with the amount given by a share of it, rounded down', () => {
    expect(priceAfter(1_000_000, 0, 5)).toBe(1_000_000);
    expect(priceAfter(1_000_000, 20000, 5)).toBe(909090);
    expect(priceAfter(909090, 20000, 5)).toBe(826445);
    expect(priceAfter(1_000_000, 1, 1)).toBe(999999);
    expect(priceAfter(1_000_000, 1000, 1)).toBe(999000);
  });

  it('never reaches below 0, whatever the amount', () => {
    expect(priceAfter(1_000_000, 10_000_000, 1000)).toBe(99);
    expect(priceAfter(0, 10_000_000, 1000)).toBe(0);
    expect(priceAfter(1, Number.MAX_SAFE_INTEGER, 1000)).toBe(0);
  });
});

describe('what an amount gives', () => {
  it('is the amount times the ratio per 1,000, rounded down, less the fee (the example of the issue)', () => {
    expect(got(1000, T)).toBe(450);
    expect(got(1000, { ...T, fee: 0 })).toBe(500);
    expect(got(1002, T)).toBe(450);
    expect(got(1003, T)).toBe(451);
    expect(got(0, T)).toBe(0);
    expect(got(1, T)).toBe(0);
  });

  it('follows the price and the ratio', () => {
    expect(got(1000, { ...T, price: 909090 })).toBe(409);
    expect(got(1000, { ...T, price: 0 })).toBe(0);
    expect(got(1000, { ...T, ratio: 3000 })).toBe(2700);
    expect(got(10_000_000, { ratio: 100_000, price: 1e6, fee: 0 })).toBe(
      1_000_000_000,
    );
  });

  it('is exact where a double would round', () => {
    const t = { ratio: 99_999, price: 999_999, fee: 100 };
    const amount = 9_007_199_254;
    const exact =
      (BigInt(amount) * 99_999n * 999_999n * 900n) / 1_000_000_000_000n;
    expect(got(amount, t)).toBe(Number(exact));
  });

  it('needs the smallest amount that gives at least what is wanted', () => {
    expect(givingFor(450, T)).toBe(1000);
    expect(givingFor(451, T)).toBe(1003);
    expect(givingFor(1, T)).toBe(3);
    expect(got(givingFor(1, T), T)).toBe(1);
    expect(got(givingFor(1, T) - 1, T)).toBe(0);
    expect(givingFor(0, T)).toBe(0);
    expect(givingFor(5, { ...T, price: 0 })).toBe(Infinity);
  });

  it('has a fee of 0 at level 11 and the same ratio', () => {
    expect(got(1000, termsOf(market({ level: 11 }), 'mc'))).toBe(500);
    expect(got(1000, termsOf(market({ level: 1 }), 'mc'))).toBe(450);
    expect(termsOf(market({ level: 2 }), 'cm')).toEqual({
      ratio: 2000,
      price: 1e6,
      fee: 90,
    });
  });
});

describe('the free storage and the limit of the day', () => {
  it('is the room under the limit in whole units, never below 0', () => {
    expect(roomFor(99_000.7, 100_000)).toBe(999);
    expect(roomFor(99_000, 100_000)).toBe(1000);
    expect(roomFor(100_000, 100_000)).toBe(0);
    expect(roomFor(120_000, 100_000)).toBe(0);
  });

  it('lets a player give what the limit leaves', () => {
    expect(remaining({ used: 30, limit: 100 })).toBe(70);
    expect(remaining({ used: 100, limit: 100 })).toBe(0);
    expect(remaining({ used: 150, limit: 100 })).toBe(0);
    expect(remaining({ used: 150, limit: 0 })).toBe(Infinity);
  });
});

describe('an exchange', () => {
  it('gives the result of the example: 1,000 Adamant for 450 Psikristall, 50 of them the fee', () => {
    expect(trade(market(), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 1000,
        got: 450,
        fee: 50,
        capped: false,
        cut: false,
      },
    });
  });

  it('refuses in the order of the checks', () => {
    const error = (m: Market, ...a: [unknown, unknown, unknown]) =>
      (trade(m, ...a) as { error: string }).error;
    expect(error(market({ open: false, level: 0 }), 'x', 'x', 'x')).toBe(
      'closed',
    );
    expect(error(market({ level: 0 }), 'x', 'x', 'x')).toBe('noPost');
    expect(error(market(), 'm', 'm', 'x')).toBe('resource');
    expect(error(market(), 'm', 'e', 5)).toBe('resource');
    expect(error(market(), 'm', 'c', 'x')).toBe('amount');
    expect(error(market({ stock: { m: 0, c: 0, d: 0 } }), 'm', 'c', 1)).toBe(
      'poor',
    );
    expect(
      error(
        market({
          stock: { m: 10, c: 100000, d: 0 },
          limit: 0,
        }),
        'm',
        'c',
        100,
      ),
    ).toBe('poor');
    expect(
      error(market({ stock: { m: 5000, c: 100000, d: 0 } }), 'm', 'c', 100),
    ).toBe('full');
    expect(error(market({ limit: 100, used: 100 }), 'm', 'c', 5)).toBe('limit');
    expect(error(market(), 'm', 'c', 1)).toBe('tiny');
  });

  it('wants a whole amount of at least 1', () => {
    for (const bad of [
      0,
      -5,
      1.5,
      NaN,
      Infinity,
      '1000',
      null,
      undefined,
      2 ** 53,
    ])
      expect(trade(market(), 'm', 'c', bad), String(bad)).toEqual({
        error: 'amount',
      });
    expect(trade(market(), 'm', 'c', 1000)).toHaveProperty('quote');
    expect(trade(market(), 'm', 'c', 2 ** 53 - 1)).toEqual({ error: 'poor' });
  });

  it('gives at most what the planet has, the whole units of it', () => {
    const m = market({ stock: { m: 1000.9, c: 0, d: 0 } });
    expect(trade(m, 'm', 'c', 1000)).toHaveProperty('quote');
    expect(trade(m, 'm', 'c', 1001)).toEqual({ error: 'poor' });
  });

  it('is refused when the target storage is full, however little room is left', () => {
    const full = market({ stock: { m: 5000, c: 100000, d: 0 } });
    expect(trade(full, 'm', 'c', 1000)).toEqual({ error: 'full' });
    expect(
      trade(market({ stock: { m: 5000, c: 99999.5, d: 0 } }), 'm', 'c', 1000),
    ).toEqual({
      error: 'full',
    });
    // One unit of room is room enough: 3 Adamant give it (1.35, rounded down).
    expect(
      trade(market({ stock: { m: 5000, c: 99999, d: 0 } }), 'm', 'c', 1000),
    ).toEqual({
      quote: { pair: 'mc', given: 3, got: 1, fee: 0, capped: true, cut: false },
    });
  });

  it('caps the result by the free storage and takes only the amount that gives it (D4)', () => {
    const m = market({ stock: { m: 5000, c: 99_700.5, d: 0 } });
    // The room is 299; 1,000 Adamant would give 450.
    expect(trade(m, 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 665,
        got: 299,
        fee: 33,
        capped: true,
        cut: false,
      },
    });
    // 665 is the least amount that gives 299.
    const t = termsOf(m, 'mc');
    expect(got(665, t)).toBe(299);
    expect(got(664, t)).toBe(298);
    // Not capped when the result fits exactly.
    expect(trade(m, 'm', 'c', 664)).toEqual({
      quote: {
        pair: 'mc',
        given: 664,
        got: 298,
        fee: 34,
        capped: false,
        cut: false,
      },
    });
  });

  it('may take an amount that gives more than the room when no smaller one gives exactly the room', () => {
    // 1 Adamant gives 3 Psikristall at 3000 per 1,000 and no fee; room 2.
    const m = market({
      level: 11,
      ratios: { ...DEFAULT_RATIOS, mc: 3000 },
      stock: { m: 10, c: 99_998, d: 0 },
    });
    expect(trade(m, 'm', 'c', 10)).toEqual({
      quote: { pair: 'mc', given: 1, got: 2, fee: 0, capped: true, cut: false },
    });
  });

  it('cuts an amount above what is left of the day to it, not refused (owner, 2026-11-19)', () => {
    expect(trade(market({ used: 99_001 }), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 999,
        got: 449,
        fee: 50,
        capped: false,
        cut: true,
      },
    });
    // What is left is just enough: nothing is cut.
    expect(trade(market({ used: 99_000 }), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 1000,
        got: 450,
        fee: 50,
        capped: false,
        cut: false,
      },
    });
  });

  it('refuses only when nothing is left of the day', () => {
    expect(trade(market({ used: 100_000 }), 'm', 'c', 1000)).toEqual({
      error: 'limit',
    });
    expect(trade(market({ used: 120_000 }), 'm', 'c', 1000)).toEqual({
      error: 'limit',
    });
    expect(trade(market({ used: 99_999 }), 'm', 'c', 1000)).toEqual({
      error: 'tiny',
    });
  });

  it('has no limit at all with a limit of 0', () => {
    const m = market({ limit: 0, used: 5_000_000_000 });
    expect(remaining(m)).toBe(Infinity);
    expect(trade(m, 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 1000,
        got: 450,
        fee: 50,
        capped: false,
        cut: false,
      },
    });
    expect(maxGive(m, 'm', 'c')).toBe(5000);
  });

  it('lets the smaller of the storage and the limit win, and names only that one', () => {
    // The room is 299: 665 Adamant fill it, 1,000 would give 450.
    const full = { stock: { m: 5000, c: 99_700.5, d: 0 } };
    // 500 are left: the limit is smaller than the 665 the storage allows.
    expect(trade(market({ ...full, used: 99_500 }), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 500,
        got: 225,
        fee: 25,
        capped: false,
        cut: true,
      },
    });
    // 700 are left: the storage is smaller.
    expect(trade(market({ ...full, used: 99_300 }), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 665,
        got: 299,
        fee: 33,
        capped: true,
        cut: false,
      },
    });
    // Exactly the 665 are left: the storage is what limits, the limit is just met.
    expect(trade(market({ ...full, used: 99_335 }), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 665,
        got: 299,
        fee: 33,
        capped: true,
        cut: false,
      },
    });
    // Nothing of the day left and a full storage: the storage is named first.
    expect(
      trade(
        market({ stock: { m: 5000, c: 100000, d: 0 }, used: 100_000 }),
        'm',
        'c',
        1000,
      ),
    ).toEqual({ error: 'full' });
  });

  it('counts the amount cut, not the amount asked, as given', () => {
    const m = market({ used: 99_500 });
    const result = trade(m, 'm', 'c', 1000) as {
      quote: { given: number };
    };
    expect(result.quote.given).toBe(500);
    expect(remaining({ ...m, used: m.used + result.quote.given })).toBe(0);
  });

  it('is refused when it gives nothing, after the cap', () => {
    expect(trade(market(), 'm', 'c', 2)).toEqual({ error: 'tiny' });
    expect(
      trade(market({ prices: { ...market().prices, mc: 0 } }), 'm', 'c', 1000),
    ).toEqual({ error: 'tiny' });
  });

  it('pays the lower price after an earlier exchange', () => {
    const lower = market({ prices: { ...market().prices, mc: 909090 } });
    expect(trade(lower, 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 1000,
        got: 409,
        fee: 45,
        capped: false,
        cut: false,
      },
    });
    // The other direction keeps its price.
    expect(trade(lower, 'c', 'm', 100)).toEqual({
      quote: {
        pair: 'cm',
        given: 100,
        got: 180,
        fee: 20,
        capped: false,
        cut: false,
      },
    });
  });

  it('takes the fee of the level of the Handelsposten', () => {
    expect(trade(market({ level: 6 }), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 1000,
        got: 475,
        fee: 25,
        capped: false,
        cut: false,
      },
    });
    expect(trade(market({ level: 11 }), 'm', 'c', 1000)).toEqual({
      quote: {
        pair: 'mc',
        given: 1000,
        got: 500,
        fee: 0,
        capped: false,
        cut: false,
      },
    });
  });

  it('names the largest amount that can be given now', () => {
    expect(maxGive(market(), 'm', 'c')).toBe(5000);
    expect(maxGive(market({ limit: 1200, used: 500 }), 'm', 'c')).toBe(700);
    // The room of 299 needs 665 Adamant.
    expect(
      maxGive(market({ stock: { m: 5000, c: 99_700.5, d: 0 } }), 'm', 'c'),
    ).toBe(665);
    expect(
      maxGive(market({ stock: { m: 5000.9, c: 0, d: 0 } }), 'm', 'c'),
    ).toBe(5000);
  });

  it('names 0 when nothing can be exchanged', () => {
    expect(maxGive(market({ open: false }), 'm', 'c')).toBe(0);
    expect(maxGive(market({ level: 0 }), 'm', 'c')).toBe(0);
    expect(maxGive(market(), 'm', 'm')).toBe(0);
    expect(
      maxGive(market({ stock: { m: 5000, c: 100000, d: 0 } }), 'm', 'c'),
    ).toBe(0);
    expect(maxGive(market({ limit: 10, used: 10 }), 'm', 'c')).toBe(0);
  });

  it('gives what maxGive names without a refusal other than the amount being too small', () => {
    const m = market({ stock: { m: 5000, c: 99_700.5, d: 0 } });
    expect(trade(m, 'm', 'c', maxGive(m, 'm', 'c'))).toHaveProperty('quote');
  });
});

/** The values 1 to 50 of three resources as the ratios an admin may derive: 1,000 · value / value. */
const ratiosFromValues = (
  v: Record<Res, number>,
  slack: Record<Pair, number>,
): Record<Pair, number> =>
  Object.fromEntries(
    PAIRS.map((p) => [
      p,
      Math.max(
        1,
        Math.floor((RATIO_UNIT * v[p[0] as Res]) / v[p[1] as Res]) - slack[p],
      ),
    ]),
  ) as Record<Pair, number>;

const values = fc.record({
  m: fc.integer({ min: 1, max: 50 }),
  c: fc.integer({ min: 1, max: 50 }),
  d: fc.integer({ min: 1, max: 50 }),
});
const slacks = fc.record({
  mc: fc.integer({ min: 0, max: 40 }),
  md: fc.integer({ min: 0, max: 40 }),
  cm: fc.integer({ min: 0, max: 40 }),
  cd: fc.integer({ min: 0, max: 40 }),
  dm: fc.integer({ min: 0, max: 40 }),
  dc: fc.integer({ min: 0, max: 40 }),
});
/** Ratios near 1, so many sets pass the filter of the panel's warning. */
const near = fc.integer({ min: 1, max: 1100 });
const anyRatios = fc.record({
  mc: near,
  md: near,
  cm: near,
  cd: near,
  dm: near,
  dc: near,
});

/** An exchange of a sequence: a pair, a share of the stock, and the hours before it. */
const step = fc.record({
  pair: fc.constantFrom(...PAIRS),
  share: fc.integer({ min: 1, max: 1000 }),
  hours: fc.integer({ min: 0, max: 60 }),
});

const setup = fc.record({
  level: fc.integer({ min: 1, max: 15 }),
  feeBase: fc.integer({ min: FEE.min, max: FEE.max }),
  feeStep: fc.integer({ min: FEE_STEP.min, max: FEE_STEP.max }),
  step: fc.integer({ min: STEP.min, max: STEP.max }),
  drift: fc.integer({ min: DRIFT_HOURS.min, max: DRIFT_HOURS.max }),
  start: fc.constantFrom<Res>(...TRADED),
  amount: fc.integer({ min: 1, max: 5_000_000 }),
  caps: fc.integer({ min: 1, max: 50_000_000 }),
  steps: fc.array(step, { minLength: 1, maxLength: 25 }),
});

type Setup = {
  level: number;
  feeBase: number;
  feeStep: number;
  step: number;
  drift: number;
  start: Res;
  amount: number;
  caps: number;
  steps: { pair: Pair; share: number; hours: number }[];
};

/**
 * Plays a sequence of exchanges as the server does: the prices drift, every
 * exchange lowers the price of its pair, the planet's stock changes. The
 * player starts with `amount` of one resource, then everything is
 * exchanged back into it. Returns the stock after each exchange, and the
 * start resource at the end.
 */
function play(ratios: Record<Pair, number>, s: Setup) {
  const stock: Record<Res, number> = { m: 0, c: 0, d: 0 };
  stock[s.start] = s.amount;
  const states: Partial<Record<Pair, PriceState>> = {};
  const history: Record<Res, number>[] = [{ ...stock }];
  let now = 0;
  const exchange = (pair: Pair, asked: number) => {
    const prices = Object.fromEntries(
      PAIRS.map((p) => [p, priceNow(states[p], now, s.drift)]),
    ) as Record<Pair, number>;
    const m: Market = {
      open: true,
      level: s.level,
      stock,
      caps: { m: s.caps, c: s.caps, d: s.caps },
      ratios,
      prices,
      used: 0,
      limit: 0,
      feeBase: s.feeBase,
      feeStep: s.feeStep,
    };
    const result = trade(m, pair[0], pair[1], asked);
    if (!('quote' in result)) return;
    const q = result.quote;
    stock[pair[0] as Res] -= q.given;
    stock[pair[1] as Res] += q.got;
    states[pair] = {
      price: priceAfter(prices[pair], q.given, s.step),
      at: now,
    };
    history.push({ ...stock });
  };
  for (const x of s.steps) {
    now += x.hours * HOUR_MS;
    const have = stock[x.pair[0] as Res];
    if (have >= 1)
      exchange(x.pair, Math.max(1, Math.floor((have * x.share) / 1000)));
  }
  for (const other of TRADED) {
    now += HOUR_MS;
    const have = stock[other];
    if (other !== s.start && have >= 1)
      exchange(`${other}${s.start}` as Pair, have);
  }
  return { stock, history };
}

describe('no sequence of exchanges yields more than it started with (#171, acceptance)', () => {
  it('holds for ratios derived from values: the value of the stock never rises', () => {
    fc.assert(
      fc.property(values, slacks, setup, (v, slack, s) => {
        const ratios = ratiosFromValues(v, slack);
        expect(gainingTrips(ratios)).toEqual([]);
        const { history } = play(ratios, s);
        const worth = (x: Record<Res, number>): number =>
          x.m * v.m + x.c * v.c + x.d * v.d;
        for (let i = 1; i < history.length; i++)
          expect(worth(history[i]!)).toBeLessThanOrEqual(
            worth(history[i - 1]!),
          );
      }),
      { seed: 171, numRuns: 400 },
    );
  });

  it('holds for any ratios the panel does not warn about: the start resource ends at most as it began', () => {
    fc.assert(
      fc.property(anyRatios, setup, (ratios, s) => {
        fc.pre(gainingTrips(ratios).length === 0);
        const { stock } = play(ratios, s);
        expect(stock[s.start]).toBeLessThanOrEqual(s.amount);
      }),
      { seed: 171, numRuns: 400 },
    );
  });

  it('is a gain only where the ratios gain: an exchange back and forth never returns more at fee 0 without it', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 1, max: 10_000_000 }),
        (a, b, amount) => {
          fc.pre(a * b <= RATIO_UNIT * RATIO_UNIT);
          const there = got(amount, { ratio: a, price: PRICE_UNIT, fee: 0 });
          const back = got(there, { ratio: b, price: PRICE_UNIT, fee: 0 });
          expect(back).toBeLessThanOrEqual(amount);
        },
      ),
      { seed: 171, numRuns: 500 },
    );
  });

  it('rounds down exactly: the result times the divisor never exceeds the exact product', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 100_000 }),
        fc.integer({ min: 0, max: PRICE_UNIT }),
        fc.integer({ min: 0, max: FEE.max * 10 }),
        (amount, ratio, price, fee) => {
          const result = BigInt(got(amount, { ratio, price, fee }));
          const exact =
            BigInt(amount) *
            BigInt(ratio) *
            BigInt(price) *
            BigInt(FEE_UNIT - fee);
          const divisor = 1_000_000_000_000n;
          expect(result * divisor).toBeLessThanOrEqual(exact);
          expect((result + 1n) * divisor).toBeGreaterThan(exact);
        },
      ),
      { seed: 171, numRuns: 500 },
    );
  });

  it('keeps every quote inside the checks: whole, within the stock, the room and the limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5_000_000 }),
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 0, max: 5_000_000 }),
        fc.integer({ min: 1, max: 20 }),
        fc.constantFrom(...PAIRS),
        (stock, cap, asked, used, level, pair) => {
          const m = market({
            level,
            stock: { m: stock, c: stock, d: stock },
            caps: { m: cap, c: cap, d: cap },
            used,
            limit: 2_000_000,
          });
          const result = trade(m, pair[0], pair[1], asked);
          if (!('quote' in result)) return;
          const q = result.quote;
          expect(Number.isInteger(q.given) && Number.isInteger(q.got)).toBe(
            true,
          );
          expect(q.given).toBeGreaterThanOrEqual(1);
          expect(q.given).toBeLessThanOrEqual(Math.min(asked, stock));
          expect(q.got).toBeGreaterThanOrEqual(1);
          expect(q.got).toBeLessThanOrEqual(roomFor(stock, cap));
          expect(used + q.given).toBeLessThanOrEqual(2_000_000);
          expect(q.fee).toBeGreaterThanOrEqual(0);
          if (q.capped) expect(q.got).toBe(roomFor(stock, cap));
        },
      ),
      { seed: 171, numRuns: 500 },
    );
  });
});
