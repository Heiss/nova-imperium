import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { BUILD, buildable, PLACEMENT } from './catalog.ts';
import {
  DEMOLITION_REFUND,
  DEMOLITION_TIME,
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
import {
  ROUND_SETTINGS,
  roundFieldId,
  roundRefused,
  roundRequest,
  roundValues,
  storedValues,
} from './round.ts';
import { settle } from './settle.ts';
import type { Cost, ResearchState, Universe } from './types.ts';
import { DEFAULT_UNIVERSE, liveSpecs, universeErrors } from './universe.ts';

const R: Pick<ResearchState, 'rq'> = { rq: null };
const at = (refund: number, time = 50): Universe => ({
  ...U,
  roundDemolitionRefund: refund,
  roundDemolitionTime: time,
});

describe('the settings of a demolition (#202, #283, #310)', () => {
  /** The two settings, as the registry holds them (the group `demolition`). */
  const SETTINGS = ROUND_SETTINGS.filter((s) => s.group?.name === 'demolition');
  const current = { demolitionRefund: 50, demolitionTime: 50 };
  const refused = (data: Record<string, unknown>): string[] =>
    roundRefused(current, data, SETTINGS).map((s) => s.name);

  it('have the owner’s ranges and defaults (D3, D7)', () => {
    expect(DEMOLITION_REFUND).toEqual({ min: -100, max: 100, default: 50 });
    expect(DEMOLITION_TIME).toEqual({ min: 1, max: 200, default: 50 });
  });

  it('are two live number fields of one group with the legend „Rückbau“, in the order 180, 190 (D4, X1)', () => {
    const group = { name: 'demolition', legend: 'Rückbau' };
    const common = { kind: 'number', live: true, group };
    expect(SETTINGS).toEqual([
      {
        ...common,
        key: 'roundDemolitionRefund',
        name: 'demolitionRefund',
        label: 'Rückbau-Erstattung (%)',
        order: 180,
        min: -100,
        max: 100,
        def: 50,
      },
      {
        ...common,
        key: 'roundDemolitionTime',
        name: 'demolitionTime',
        label: 'Rückbau-Dauer (% der Bauzeit)',
        order: 190,
        min: 1,
        max: 200,
        def: 50,
      },
    ]);
    // One group object, so the two are sent and refused together.
    for (const s of SETTINGS) expect(s.group).toBe(SETTINGS[0]!.group);
    expect(SETTINGS.map(roundFieldId)).toEqual([
      'round-demolition-refund',
      'round-demolition-time',
    ]);
    // Neighbours in the registry: the dialog shows them in one fieldset.
    const first = ROUND_SETTINGS.indexOf(SETTINGS[0]!);
    expect(ROUND_SETTINGS.slice(first, first + 2)).toEqual(SETTINGS);
  });

  it('are rows of the universe settings, in this order, with their ranges and the defaults +50 % and 50 %, checked there (X1)', () => {
    const rows = [
      ['roundDemolitionRefund', 'Rückbau-Erstattung (%)', -100, 100],
      ['roundDemolitionTime', 'Rückbau-Dauer (% der Bauzeit)', 1, 200],
    ] as const;
    const keys: string[] = SETTINGS.map((s) => s.key);
    expect(liveSpecs().filter((s) => keys.includes(s.key))).toEqual(
      rows.map(([key, label, min, max]) => ({ key, label, min, max, def: 50 })),
    );
    expect(DEFAULT_UNIVERSE).toMatchObject({
      roundDemolitionRefund: 50,
      roundDemolitionTime: 50,
    });
    const codes = (input: Record<string, unknown>) =>
      universeErrors(
        { ...DEFAULT_UNIVERSE, ...input },
        { g: 1, s: 1, p: 1 },
      ).map((e) => [e.spec.key, e.code]);
    for (const roundDemolitionRefund of [-100, 0, 100])
      expect(codes({ roundDemolitionRefund })).toEqual([]);
    for (const roundDemolitionRefund of [-101, 101, 2.5])
      expect(codes({ roundDemolitionRefund })).toEqual([
        ['roundDemolitionRefund', 'range'],
      ]);
    for (const roundDemolitionTime of [1, 200])
      expect(codes({ roundDemolitionTime })).toEqual([]);
    for (const roundDemolitionTime of [0, 201, 1.5])
      expect(codes({ roundDemolitionTime })).toEqual([
        ['roundDemolitionTime', 'range'],
      ]);
  });

  it('are read from the settings of the universe', () => {
    expect([refundOf(U), timeOf(U)]).toEqual([50, 50]);
    expect([refundOf(at(-30, 120)), timeOf(at(-30, 120))]).toEqual([-30, 120]);
  });

  it('are read from the stored settings, a missing one is the default, and sent as one object', () => {
    const stored: Record<string, number> = { roundDemolitionRefund: -40 };
    expect(storedValues((k) => stored[k])).toMatchObject({
      demolitionRefund: -40,
      demolitionTime: 50,
    });
    expect(roundRequest(storedValues(() => undefined))).toMatchObject({
      demolition: { demolitionRefund: 50, demolitionTime: 50 },
    });
    const sent = { demolitionRefund: -100, demolitionTime: 1 };
    expect(roundRequest(sent, SETTINGS)).toEqual({ demolition: sent });
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
    // Without a level there is nothing to tear down, whatever the fields are.
    expect(
      codes({ ...small, b: { terraformer: 1, metal: 10 } }, 'crystal'),
    ).toEqual(['none']);
  });

  it('not while the places left in the Raketenkrypta would be fewer than its missiles (#54, 2026-11-21)', () => {
    // A level of the Raketenkrypta holds 10 places: an Abfangrakete takes 1,
    // an Orbitalrakete 2.
    const down = (b: number, def: Record<string, number>, sq = []) =>
      codes({ b: { silo: b }, def, sq }, 'silo');
    // Level 2 to 1 leaves 10 places: exactly as many as the missiles take.
    expect(down(2, { abm: 10 })).toEqual([]);
    expect(down(2, { abm: 5, ipm: 2 })).toEqual([]);
    expect(down(2, { ipm: 5 })).toEqual([]);
    // One place more than are left.
    expect(down(2, { abm: 11 })).toEqual(['siloBusy']);
    expect(down(2, { abm: 9, ipm: 1 })).toEqual(['siloBusy']);
    expect(down(2, { ipm: 6 })).toEqual(['siloBusy']);
    // The last level leaves no place.
    expect(down(1, {})).toEqual([]);
    expect(down(1, { abm: 1 })).toEqual(['siloBusy']);
    // The shipyard queue counts, as for an order; other units do not.
    expect(
      down(2, { abm: 6 }, [{ key: 'abm', n: 4, unit: 5 }] as never),
    ).toEqual([]);
    expect(
      down(2, { abm: 6 }, [{ key: 'abm', n: 5, unit: 5 }] as never),
    ).toEqual(['siloBusy']);
    expect(
      down(2, { ipm: 5 }, [{ key: 'lc', n: 50, unit: 5 }] as never),
    ).toEqual([]);
    // Without a level there is nothing to tear down, whatever is stored.
    expect(down(0, { abm: 3 })).toEqual(['none']);
    // Only the Raketenkrypta: another building is not held back by missiles.
    expect(codes({ b: { metal: 1 }, def: { abm: 99 } }, 'metal')).toEqual([]);
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
