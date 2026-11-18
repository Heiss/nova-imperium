import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { BUILD, buildable, PLACEMENT } from './catalog.ts';
import {
  DEMOLITION_REFUND,
  DEMOLITION_REFUND_SETTING,
  DEMOLITION_TIME,
  DEMOLITION_TIME_SETTING,
  demolishedCost,
  demolitionErrors,
  demolitionMoves,
  demolitionOrder,
  demolitionTime,
  isDemolition,
  refundOf,
  timeOf,
} from './demolition.ts';
import { buildTime, lvlCost } from './economy.ts';
import { roundRefused, roundValues } from './round.ts';
import { settle } from './settle.ts';
import type { Cost, ResearchState, Universe } from './types.ts';

const R: Pick<ResearchState, 'rq'> = { rq: null };
const at = (refund: number, time = 50): Universe => ({
  ...U,
  roundDemolitionRefund: refund,
  roundDemolitionTime: time,
});

describe('the settings of a demolition (#202, #283)', () => {
  const SETTINGS = [DEMOLITION_REFUND_SETTING, DEMOLITION_TIME_SETTING];
  const current = { demolitionRefund: 50, demolitionTime: 50 };
  const refused = (data: Record<string, unknown>): string[] =>
    roundRefused(current, data, SETTINGS).map((s) => s.name);

  it('have the owner’s ranges and defaults (D3, D7)', () => {
    expect(DEMOLITION_REFUND).toEqual({ min: -100, max: 100, default: 50 });
    expect(DEMOLITION_TIME).toEqual({ min: 1, max: 200, default: 50 });
  });

  it('are two entries of the registry, set in „Neue Runde“ and live (X1)', () => {
    expect(DEMOLITION_REFUND_SETTING).toEqual({
      kind: 'number',
      key: 'roundDemolitionRefund',
      name: 'demolitionRefund',
      label: 'Rückbau-Erstattung (%)',
      order: 180,
      group: { name: 'demolition' },
      min: -100,
      max: 100,
      def: 50,
      live: true,
    });
    expect(DEMOLITION_TIME_SETTING).toEqual({
      kind: 'number',
      key: 'roundDemolitionTime',
      name: 'demolitionTime',
      label: 'Rückbau-Dauer (% der Bauzeit)',
      order: 190,
      group: { name: 'demolition' },
      min: 1,
      max: 200,
      def: 50,
      live: true,
    });
  });

  it('are read from the settings of the universe', () => {
    expect([refundOf(U), timeOf(U)]).toEqual([50, 50]);
    expect([refundOf(at(-30, 120)), timeOf(at(-30, 120))]).toEqual([-30, 120]);
  });

  it('take whole percent within the ranges for a new round, the current ones when not sent (X1)', () => {
    expect(refused({})).toEqual([]);
    for (const ok of [
      { demolitionRefund: -100, demolitionTime: 1 },
      { demolitionRefund: 100, demolitionTime: 200 },
      { demolitionRefund: 0, demolitionTime: 50 },
    ])
      expect(refused({ demolition: ok })).toEqual([]);
    const sent = { demolition: { demolitionRefund: -100, demolitionTime: 7 } };
    expect(roundValues(current, sent, SETTINGS)).toEqual(sent.demolition);
    expect(roundValues(current, {}, SETTINGS)).toEqual(current);
  });

  it('refuse a whole percent outside the ranges, both settings together', () => {
    const wrong = (demolition: unknown) => refused({ demolition });
    const both = ['demolitionRefund', 'demolitionTime'];
    // A setting of the group that is not sent is refused too (as before #283).
    expect(wrong({ demolitionRefund: -101, demolitionTime: 50 })).toEqual([
      'demolitionRefund',
    ]);
    expect(wrong({ demolitionRefund: 101, demolitionTime: 50 })).toEqual([
      'demolitionRefund',
    ]);
    expect(wrong({ demolitionRefund: 1.5, demolitionTime: 50 })).toEqual([
      'demolitionRefund',
    ]);
    expect(wrong({ demolitionRefund: null, demolitionTime: 50 })).toEqual([
      'demolitionRefund',
    ]);
    expect(wrong({ demolitionRefund: 50, demolitionTime: 0 })).toEqual([
      'demolitionTime',
    ]);
    expect(wrong({ demolitionRefund: 50, demolitionTime: 201 })).toEqual([
      'demolitionTime',
    ]);
    expect(wrong({ demolitionRefund: 50, demolitionTime: '50' })).toEqual([
      'demolitionTime',
    ]);
    expect(wrong({ demolitionRefund: -101, demolitionTime: 0 })).toEqual(both);
    expect(wrong({ demolitionRefund: 50 })).toEqual(['demolitionTime']);
    expect(wrong(null)).toEqual(both);
  });
});

describe('what a demolition moves (D2, D7)', () => {
  const cost: Cost = [800, 400, 201];

  it('gives back the share of a positive factor at the end, rounded down', () => {
    expect(demolitionMoves(cost, 100)).toEqual({
      pay: [0, 0, 0],
      back: [800, 400, 201],
    });
    expect(demolitionMoves(cost, 50)).toEqual({
      pay: [0, 0, 0],
      back: [400, 200, 100],
    });
  });

  it('moves nothing at 0 %', () => {
    expect(demolitionMoves(cost, 0)).toEqual({
      pay: [0, 0, 0],
      back: [0, 0, 0],
    });
  });

  it('costs the share of a negative factor at the start, −100 % the cost once more', () => {
    expect(demolitionMoves(cost, -100)).toEqual({
      pay: [800, 400, 201],
      back: [0, 0, 0],
    });
    expect(demolitionMoves(cost, -50)).toEqual({
      pay: [400, 200, 100],
      back: [0, 0, 0],
    });
  });

  it('never moves more than the cost, nor less than nothing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -100, max: 100 }),
        fc.tuple(fc.nat(1e9), fc.nat(1e9), fc.nat(1e9)),
        (f, c) => {
          const { pay, back } = demolitionMoves(c, f);
          for (const [i, x] of c.entries()) {
            expect(pay[i]! + back[i]!).toBeLessThanOrEqual(x);
            expect(Math.min(pay[i]!, back[i]!)).toBe(0);
            expect(pay[i]! + back[i]!).toBe(
              Math.floor((x * Math.abs(f)) / 100),
            );
          }
        },
      ),
    );
  });

  it('is based on the cost of the level that stands', () => {
    expect(demolishedCost({ b: { yard: 2 } }, 'yard')).toEqual(
      lvlCost(BUILD.yard!, 2),
    );
    expect(demolishedCost({ b: { metal: 1 } }, 'metal')).toEqual([60, 15, 0]);
  });
});

describe('the time of a demolition (D3)', () => {
  it('is the share of the build time of the level, rounded up', () => {
    const p = planet({ b: { yard: 2 } });
    const full = buildTime(lvlCost(BUILD.yard!, 2), p, U);
    expect(full).toBe(345600);
    expect(demolitionTime(p, 'yard', at(50, 50))).toBe(172800);
    expect(demolitionTime(p, 'yard', at(50, 200))).toBe(691200);
    expect(demolitionTime(p, 'yard', at(50, 1))).toBe(3456);
    expect(demolitionTime(p, 'yard', at(50, 3))).toBe(Math.ceil(full * 0.03));
    expect(
      demolitionTime(planet({ b: { metal: 1 } }), 'metal', at(50, 7)),
    ).toBe(Math.ceil((buildTime([60, 15, 0], planet(), U) * 7) / 100));
  });
});

describe('the order of a demolition (D1)', () => {
  it('goes down one level and keeps what it paid and what it gives back', () => {
    const p = planet({ b: { yard: 2 } });
    expect(demolitionOrder(p, 'yard', at(50), 1000)).toEqual({
      key: 'yard',
      lvl: 1,
      start: 1000,
      end: 1000 + 172800,
      cost: [0, 0, 0],
      back: [400, 200, 100],
    });
    expect(demolitionOrder(p, 'yard', at(-25), 0)).toMatchObject({
      cost: [200, 100, 50],
      back: [0, 0, 0],
    });
  });

  it('is told apart from building by what it gives back', () => {
    expect(isDemolition(null)).toBe(false);
    expect(isDemolition(undefined)).toBe(false);
    expect(isDemolition({})).toBe(false);
    expect(isDemolition({ back: [0, 0, 0] })).toBe(true);
  });

  it('lowers the level and gives back at its end, with production before and after', () => {
    const p = planet({
      b: { metal: 1 },
      res: { m: 0, c: 0, d: 0 },
      bq: { ...demolitionOrder(planet({ b: { metal: 1 } }), 'metal', U, 0) },
    });
    const end = p.bq!.end;
    const before = settle(p, end - 1, U);
    expect(before.b.metal).toBe(1);
    expect(before.bq).not.toBeNull();
    const done = settle(p, end, U);
    expect(done.b.metal).toBe(0);
    expect(done.bq).toBeNull();
    // 50 % of [60, 15, 0] on top of what the mine made until then.
    expect(done.res.c).toBeGreaterThanOrEqual(7);
    const kept = settle({ ...p, bq: { ...p.bq!, back: [0, 0, 0] } }, end, U);
    expect(done.res.m - kept.res.m).toBe(30);
    expect(done.res.c - kept.res.c).toBe(7);
  });
});

describe('why a level cannot be torn down (D5)', () => {
  const codes = (
    over: Parameters<typeof planet>[0],
    key: string,
    u = U,
    r = R,
  ) => demolitionErrors(planet(over), r, key, u);

  it('can be torn down on a planet with the level, a free queue and nothing in use', () => {
    expect(codes({ b: { metal: 3 } }, 'metal')).toEqual([]);
  });

  it('not on a moon, nor without a level', () => {
    expect(codes({ kind: 'moon', b: { moonbase: 1 } }, 'moonbase')).toEqual([
      'place',
    ]);
    expect(codes({ b: {} }, 'metal')).toEqual(['none']);
    expect(codes({ b: { metal: 0 } }, 'metal')).toEqual(['none']);
  });

  it('not on any moon: every building that stands on a moon, the Warp-Tor too, is refused as „place“', () => {
    const onMoon = Object.keys(PLACEMENT).filter((key) =>
      buildable(key, 'moon'),
    );
    expect(onMoon).toEqual(
      expect.arrayContaining(['moonbase', 'phalanx', 'jumpgate']),
    );
    for (const key of onMoon)
      expect(codes({ kind: 'moon', b: { [key]: 2 } }, key), key).toEqual([
        'place',
      ]);
  });

  it('not while the build queue runs', () => {
    const bq = {
      key: 'crystal',
      lvl: 1,
      start: 0,
      end: 9,
      cost: [0, 0, 0] as Cost,
    };
    expect(codes({ b: { metal: 1 }, bq }, 'metal')).toEqual(['busy']);
  });

  it('not while the shipyard builds or the lab researches', () => {
    const sq = [{ key: 'lc', n: 1, unit: 10 }];
    expect(codes({ b: { yard: 2 }, sq }, 'yard')).toEqual(['yardBusy']);
    expect(codes({ b: { nanite: 1 }, sq }, 'nanite')).toEqual(['yardBusy']);
    expect(codes({ b: { metal: 1 }, sq }, 'metal')).toEqual([]);
    const rq = {
      key: 'energy',
      lvl: 1,
      start: 0,
      end: 9,
      cost: [0, 0, 0] as Cost,
    };
    expect(codes({ b: { lab: 1 } }, 'lab', U, { rq })).toEqual(['labBusy']);
    expect(codes({ b: { metal: 1 } }, 'metal', U, { rq })).toEqual([]);
  });

  it('not when the planet would hold more levels than fields (the Weltenschmiede)', () => {
    // 2,000 km: 4 fields; a Weltenschmiede of 1 gives 5 more and takes 1.
    const small = { diameter: 2000 };
    const terraformer = (metal: number, unlimited = false) =>
      codes(
        { ...small, unlimited, b: { terraformer: 1, metal } },
        'terraformer',
      );
    expect(terraformer(3)).toEqual([]);
    expect(terraformer(4)).toEqual([]);
    expect(terraformer(5)).toEqual(['fields']);
    expect(terraformer(9, true)).toEqual([]);
    expect(
      codes({ ...small, b: { terraformer: 1, metal: 5 } }, 'metal'),
    ).toEqual([]);
  });

  it('with a negative factor not without the resources, as for building', () => {
    // −100 % of level 2 of the shipyard: 800 / 400 / 200.
    const u = at(-100);
    const enough = { m: 800, c: 400, d: 200 };
    expect(codes({ b: { yard: 2 }, res: enough }, 'yard', u)).toEqual([]);
    for (const res of [
      { ...enough, m: 799 },
      { ...enough, c: 399 },
      { ...enough, d: 199 },
    ])
      expect(codes({ b: { yard: 2 }, res }, 'yard', u)).toEqual(['cost']);
    // A positive factor costs nothing.
    expect(
      codes({ b: { yard: 2 }, res: { m: 0, c: 0, d: 0 } }, 'yard', at(100)),
    ).toEqual([]);
  });

  it('names every reason, in the order of the server', () => {
    const rq = {
      key: 'energy',
      lvl: 1,
      start: 0,
      end: 9,
      cost: [0, 0, 0] as Cost,
    };
    const bq = {
      key: 'metal',
      lvl: 1,
      start: 0,
      end: 9,
      cost: [0, 0, 0] as Cost,
    };
    expect(
      codes(
        { kind: 'moon', b: {}, bq, res: { m: 0, c: 0, d: 0 } },
        'lab',
        at(-100),
        { rq },
      ),
    ).toEqual(['place', 'none', 'busy', 'labBusy']);
    expect(
      codes(
        {
          diameter: 2000,
          b: { terraformer: 1, metal: 5 },
          bq,
          res: { m: 0, c: 0, d: 0 },
        },
        'terraformer',
        at(-1),
      ),
    ).toEqual(['fields', 'busy', 'cost']);
  });
});
