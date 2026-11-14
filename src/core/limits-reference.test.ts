// yard.ts and the energy check from the components `limit` and
// `energyThreshold` (#114) give what they gave before: a property test on
// generated planets, queues and levels (owner, 2026-11-14). The reference
// below is unitRoom() and orderMax() of yard.ts and energyNeed() and
// energyShort() of research.ts as they were on main before the limits group,
// copied unchanged; they read the tables DEF, UNIT, BUILD and RES, which
// catalog.test.ts holds equal to before.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { U } from '../test/fixtures.ts';
import * as C from './catalog.ts';
import { DEF, type ResearchDef, UNIT } from './catalog.ts';
import { maxAfford, production } from './economy.ts';
import * as R from './research.ts';
import type { Levels, Planet, Universe } from './types.ts';
import * as Y from './yard.ts';

// ---- reference: yard.ts and research.ts before the limits group ----

function unitRoom(p: Pick<Planet, 'def' | 'sq'>, key: string): number {
  if (!Object.hasOwn(DEF, key) || !DEF[key]!.once) return Infinity;
  const queued = p.sq.filter((q) => q.key === key).reduce((n, q) => n + q.n, 0);
  return Math.max(0, 1 - (p.def[key] ?? 0) - queued);
}

const orderMax = (p: Pick<Planet, 'res' | 'def' | 'sq'>, key: string): number =>
  Math.min(maxAfford(p, UNIT[key]!.cost), unitRoom(p, key));

const energyNeed = (d: Pick<ResearchDef, 'energy'>, level: number): number =>
  d.energy ? d.energy.base * Math.pow(d.energy.f, level - 1) : 0;

const energyShort = (
  d: Pick<ResearchDef, 'energy'>,
  level: number,
  p: Pick<Planet, 'b' | 'pct' | 'temp' | 'res'>,
  u: Universe,
  research: Levels = {},
): number =>
  Math.max(
    0,
    Math.ceil(energyNeed(d, level) - production(p, u, research).eProd),
  );

// ---- the property test ----

/** Every entry of the catalog and a key that is none. */
const KEYS = [
  ...Object.keys(C.BUILD),
  ...Object.keys(C.RES),
  ...Object.keys(C.UNIT),
  'nope',
];
/** Names every object inherits; they are no entries. */
const INHERITED = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];
/** Every table of the catalog in one; an inherited name finds what it inherits. */
const DEFS: Record<string, object> = { ...C.BUILD, ...C.RES, ...C.UNIT };
/** The entry of `key` as the energy check takes it; nothing for an unknown key. */
const defOf = (key: string): Pick<ResearchDef, 'energy'> => DEFS[key] ?? {};

/** What a call gives: its value, or the error it throws. */
const outcome = (f: () => number): { value: number } | { error: string } => {
  try {
    return { value: f() };
  } catch (e) {
    return { error: String(e) };
  }
};

const count = fc.integer({ min: -2, max: 5 });
const stock = fc
  .array(fc.tuple(fc.constantFrom(...KEYS, ...INHERITED), count), {
    maxLength: 12,
  })
  .map((pairs) => Object.fromEntries(pairs) as Levels);
const queue = fc.array(
  fc.record({
    key: fc.constantFrom(...KEYS, ...INHERITED),
    n: fc.integer({ min: 0, max: 4 }),
    unit: fc.integer({ min: 1, max: 1000 }),
  }),
  { maxLength: 6 },
);
const res = fc.record({
  m: fc.double({ min: 0, max: 1e7, noNaN: true }),
  c: fc.double({ min: 0, max: 1e7, noNaN: true }),
  d: fc.double({ min: 0, max: 1e7, noNaN: true }),
});
const yardPlanet = fc.record({ def: stock, sq: queue, res });

const level = fc.integer({ min: 0, max: 45 });
const levels = (keys: string[]): fc.Arbitrary<Levels> =>
  fc
    .record(Object.fromEntries(keys.map((k) => [k, level])), {
      requiredKeys: [],
    })
    .map((x) => x as Levels);
const PRODUCERS = ['metal', 'crystal', 'deut', 'solar', 'sat', 'fusion'];
const energyPlanet = fc.record({
  b: levels(['metal', 'crystal', 'deut', 'solar', 'fusion']),
  pct: fc.record(
    Object.fromEntries(
      PRODUCERS.map((k) => [
        k,
        fc.integer({ min: 0, max: 10 }).map((x) => x * 10),
      ]),
    ),
    { requiredKeys: [] },
  ) as fc.Arbitrary<Levels>,
  temp: fc.integer({ min: -60, max: 180 }),
  res,
});
const universe = fc
  .oneof(fc.constant(1), fc.integer({ min: 1, max: 100 }))
  .map((speed) => ({ ...U, speed }));

describe('limits from the components equal limits before (#114)', () => {
  it('leaves every key the room and the largest order of before', () => {
    fc.assert(
      fc.property(yardPlanet, (p) => {
        for (const k of [...KEYS, ...INHERITED]) {
          expect(Y.unitRoom(p, k), k).toBe(unitRoom(p, k));
          expect(
            outcome(() => Y.orderMax(p, k)),
            k,
          ).toStrictEqual(outcome(() => orderMax(p, k)));
        }
      }),
      { numRuns: 500 },
    );
  });

  it('leaves the domes room for one and every other key unbounded', () => {
    const empty = { def: {}, sq: [] };
    for (const k of KEYS)
      expect(Y.unitRoom(empty, k), k).toBe(
        k === 'ssd' || k === 'lsd' ? 1 : Infinity,
      );
    for (const k of INHERITED) expect(Y.unitRoom(empty, k), k).toBe(Infinity);
  });

  it('gives every entry the energy need of before for levels 0 to 60', () => {
    for (const k of [...KEYS, ...INHERITED]) {
      const d = defOf(k);
      for (let l = 0; l <= 60; l++)
        expect(Object.is(R.energyNeed(d, l), energyNeed(d, l)), k).toBe(true);
    }
  });

  it('gives every entry the energy shortage of before', () => {
    fc.assert(
      fc.property(
        energyPlanet,
        universe,
        levels(['energy']),
        fc.integer({ min: 0, max: 20 }),
        (p, u, research, l) => {
          for (const k of [...KEYS, ...INHERITED]) {
            const d = defOf(k);
            const now = R.energyShort(d, l, p, u, research);
            expect(Object.is(now, energyShort(d, l, p, u, research)), k).toBe(
              true,
            );
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it('names the same entries with an energy threshold as before', () => {
    const needs = KEYS.filter((k) => energyNeed(defOf(k), 1) > 0);
    expect(needs).toEqual(['terraformer', 'graviton']);
  });
});
