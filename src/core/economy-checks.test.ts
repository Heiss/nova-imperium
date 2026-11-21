import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { BUILD, RES, UNIT } from './catalog.ts';
import { lvlCost } from './economy.ts';
import {
  type BuildError,
  buildErrors,
  isProducer,
  type OrderError,
  orderErrors,
  type ResearchError,
  researchErrors,
} from './economy-checks.ts';
import type { Cost, Planet, Queue, ResearchState } from './types.ts';

const rich = { m: 1e9, c: 1e9, d: 1e9 };
const poor = { m: 0, c: 0, d: 0 };
const idle: ResearchState = { research: {}, rq: null };
const queue = (key: string): Queue => ({
  key,
  lvl: 1,
  start: 0,
  end: 9,
  cost: [0, 0, 0],
});
const researching = (research = {}): ResearchState => ({
  research,
  rq: queue('spy'),
});
const order = { key: 'rl', n: 1, unit: 1 };
/** Exactly the price, as the resources of a planet. */
const just = (c: Cost) => ({ m: c[0], c: c[1], d: c[2] });
/** One Adamant less than the price. */
const short = (c: Cost) => ({ ...just(c), m: c[0] - 1 });

describe('buildErrors', () => {
  const here = (over: Partial<Planet> = {}) => planet({ res: rich, ...over });

  it('is empty when the next level can start', () => {
    expect(buildErrors(here(), idle, 'metal', U)).toEqual([]);
    expect(buildErrors(here({ b: { robot: 2 } }), idle, 'yard', U)).toEqual([]);
  });

  it('refuses a building that cannot stand on the place (#53)', () => {
    const moon = here({ kind: 'moon', b: { moonbase: 5 } });
    expect(buildErrors(moon, idle, 'metal', U)).toEqual(['place']);
    expect(buildErrors(here(), idle, 'moonbase', U)).toEqual(['place']);
    expect(buildErrors(moon, idle, 'robot', U)).toEqual([]);
  });

  it('refuses missing requirements', () => {
    expect(buildErrors(here({ b: { robot: 1 } }), idle, 'yard', U)).toEqual([
      'locked',
    ]);
  });

  it('refuses a level without a free field (#51)', () => {
    // 10,000 km: 100 fields.
    const full = here({ diameter: 10000, b: { metal: 100 } });
    expect(buildErrors(full, idle, 'crystal', U)).toEqual(['full']);
    const last = here({ diameter: 10000, b: { metal: 99 } });
    expect(buildErrors(last, idle, 'crystal', U)).toEqual([]);
  });

  it('waits for the build queue, the shipyard (#48) and the lab', () => {
    expect(
      buildErrors(here({ bq: queue('metal') }), idle, 'crystal', U),
    ).toEqual(['busy']);
    const orders = here({ b: { robot: 2 }, sq: [order] });
    expect(buildErrors(orders, idle, 'yard', U)).toEqual(['yardBusy']);
    expect(buildErrors(orders, idle, 'robot', U)).toEqual([]);
    expect(buildErrors(here(), researching(), 'lab', U)).toEqual(['labBusy']);
    expect(buildErrors(here(), researching(), 'robot', U)).toEqual([]);
  });

  it('refuses a level whose energy production is short (#51)', () => {
    const forge = { research: { energy: 12 }, rq: null };
    const dark = here({ b: { nanite: 1 } });
    expect(buildErrors(dark, forge, 'terraformer', U)).toEqual(['noEnergy']);
    const sunny = here({ b: { nanite: 1, solar: 14 } });
    expect(buildErrors(sunny, forge, 'terraformer', U)).toEqual([]);
  });

  it('refuses a level the place cannot pay, the next one', () => {
    const next = lvlCost(BUILD.metal!, 6);
    const metal = (res: Planet['res']) => here({ b: { metal: 5 }, res });
    expect(buildErrors(metal(just(next)), idle, 'metal', U)).toEqual([]);
    expect(buildErrors(metal(short(next)), idle, 'metal', U)).toEqual(['cost']);
    const first = lvlCost(BUILD.metal!, 1);
    expect(buildErrors(here({ res: short(first) }), idle, 'metal', U)).toEqual([
      'cost',
    ]);
  });

  it('names every reason, the place, the requirements and the fields first (F8)', () => {
    // A moon of one field, used, while a building runs and ships are built.
    const moon = planet({
      kind: 'moon',
      b: { robot: 1 },
      bq: queue('robot'),
      sq: [order],
      res: poor,
    });
    expect(buildErrors(moon, idle, 'terraformer', U)).toEqual<BuildError[]>([
      'place',
      'locked',
      'full',
      'busy',
      'noEnergy',
      'cost',
    ]);
    expect(buildErrors(moon, idle, 'nanite', U)).toEqual<BuildError[]>([
      'place',
      'locked',
      'full',
      'busy',
      'yardBusy',
      'cost',
    ]);
    expect(buildErrors(moon, researching(), 'lab', U)).toEqual<BuildError[]>([
      'place',
      'full',
      'busy',
      'labBusy',
      'cost',
    ]);
  });
});

describe('researchErrors', () => {
  const lab = (over: Partial<Planet> = {}) =>
    planet({ res: rich, b: { lab: 1 }, ...over });

  it('is empty when the next level can start', () => {
    expect(researchErrors(lab(), idle, 'energy', U)).toEqual([]);
  });

  it('needs a lab on the place (#49)', () => {
    expect(researchErrors(planet({ res: rich }), idle, 'energy', U)).toEqual([
      'noLab',
      'locked',
    ]);
  });

  it('refuses missing requirements', () => {
    expect(researchErrors(lab(), idle, 'laser', U)).toEqual(['locked']);
    const ready = { research: { energy: 2 }, rq: null };
    expect(researchErrors(lab(), ready, 'laser', U)).toEqual([]);
  });

  it('waits for the running research and the upgrade of the lab', () => {
    expect(researchErrors(lab(), researching(), 'energy', U)).toEqual(['busy']);
    expect(
      researchErrors(lab({ bq: queue('lab') }), idle, 'energy', U),
    ).toEqual(['labUpgrading']);
    expect(
      researchErrors(lab({ bq: queue('metal') }), idle, 'energy', U),
    ).toEqual([]);
  });

  it('has the Kolonialverwaltung only in a round with it, and not past its highest level (#237)', () => {
    const ready = { research: { spy: 4, impulse: 3 }, rq: null };
    const here = lab({ b: { lab: 3 } });
    expect(researchErrors(here, ready, 'colonial', U)).toEqual(['off']);
    const on = {
      ...U,
      roundColonyBase: 6,
      roundColonyResearch: 1,
      roundColonyPerLevel: 2,
      roundColonyMaxLevel: 2,
    };
    expect(researchErrors(here, ready, 'colonial', on)).toEqual([]);
    const second = { research: { ...ready.research, colonial: 1 }, rq: null };
    expect(researchErrors(here, second, 'colonial', on)).toEqual([]);
    const last = { research: { ...ready.research, colonial: 2 }, rq: null };
    expect(researchErrors(here, last, 'colonial', on)).toEqual(['maxLevel']);
    // Another research does not ask the round.
    expect(researchErrors(lab(), idle, 'energy', U)).toEqual([]);
  });

  it('refuses a level whose energy production is short (#49)', () => {
    const big = lab({ b: { lab: 12, solar: 58 } });
    expect(researchErrors(big, idle, 'graviton', U)).toEqual(['noEnergy']);
    const sunny = lab({ b: { lab: 12, solar: 59 } });
    expect(researchErrors(sunny, idle, 'graviton', U)).toEqual([]);
  });

  it('refuses a level the place cannot pay, the next one', () => {
    const next = lvlCost(RES.energy!, 4);
    const known = { research: { energy: 3 }, rq: null };
    expect(
      researchErrors(lab({ res: just(next) }), known, 'energy', U),
    ).toEqual([]);
    const less = { ...just(next), c: next[1] - 1 };
    expect(researchErrors(lab({ res: less }), known, 'energy', U)).toEqual([
      'cost',
    ]);
  });

  it('names every reason, the lab and the requirements first (F9)', () => {
    const none = planet({ res: poor, bq: queue('lab') });
    expect(researchErrors(none, researching(), 'laser', U)).toEqual<
      ResearchError[]
    >(['noLab', 'locked', 'busy', 'labUpgrading', 'cost']);
    expect(researchErrors(none, researching(), 'graviton', U)).toEqual<
      ResearchError[]
    >(['noLab', 'locked', 'busy', 'labUpgrading', 'noEnergy']);
  });
});

describe('orderErrors', () => {
  const yard = (over: Partial<Planet> = {}) =>
    planet({ res: rich, b: { yard: 1 }, ...over });
  const shield = { research: { shield: 2 }, rq: null };

  it('is empty when the order can start', () => {
    expect(orderErrors(yard(), idle, 'rl', 1)).toEqual([]);
    expect(orderErrors(yard(), idle, 'rl', 1e9)).toEqual([]);
  });

  it('needs a shipyard that no upgrade locks (#48)', () => {
    expect(orderErrors(planet({ res: rich }), idle, 'rl', 1)).toEqual([
      'noYard',
      'locked',
    ]);
    expect(orderErrors(yard({ bq: queue('yard') }), idle, 'rl', 1)).toEqual([
      'yardLocked',
    ]);
    expect(orderErrors(yard({ bq: queue('nanite') }), idle, 'rl', 1)).toEqual([
      'yardLocked',
    ]);
    expect(orderErrors(yard({ bq: queue('robot') }), idle, 'rl', 1)).toEqual(
      [],
    );
  });

  it('refuses missing requirements', () => {
    expect(orderErrors(yard(), idle, 'gauss', 1)).toEqual(['locked']);
  });

  it('needs a count of at least one (F10)', () => {
    expect(orderErrors(yard(), idle, 'rl', 0)).toEqual(['count']);
  });

  it('keeps the limit of a unit (#50)', () => {
    expect(orderErrors(yard(), shield, 'ssd', 1)).toEqual([]);
    expect(orderErrors(yard(), shield, 'ssd', 2)).toEqual(['limit']);
    const has = yard({ def: { ssd: 1 } });
    expect(orderErrors(has, shield, 'ssd', 1)).toEqual(['limit']);
    expect(orderErrors(has, shield, 'lsd', 1)).toEqual(['locked']);
  });

  it('keeps the missiles within the places of the silo (#54)', () => {
    const impulse = { research: { impulse: 1 }, rq: null };
    const silo = (level: number, over: Partial<Planet> = {}) =>
      yard({ b: { yard: 1, silo: level }, ...over });
    // Level 2: 20 places, an Abfangrakete takes 1.
    expect(orderErrors(silo(2), idle, 'abm', 20)).toEqual([]);
    expect(orderErrors(silo(2), idle, 'abm', 21)).toEqual(['siloFull']);
    // Level 4: 40 places, an Orbitalrakete takes 2; the stock and the queue count.
    expect(orderErrors(silo(4), impulse, 'ipm', 20)).toEqual([]);
    expect(orderErrors(silo(4), impulse, 'ipm', 21)).toEqual(['siloFull']);
    const used = silo(4, {
      def: { abm: 10, ipm: 5 },
      sq: [{ key: 'abm', n: 9, unit: 1 }],
    });
    // 10 + 10 + 9 of 40 places taken: 11 are free.
    expect(orderErrors(used, impulse, 'abm', 12)).toEqual(['siloFull']);
    expect(orderErrors(used, impulse, 'abm', 11)).toEqual([]);
    expect(orderErrors(used, impulse, 'ipm', 5)).toEqual([]);
    expect(orderErrors(used, impulse, 'ipm', 6)).toEqual(['siloFull']);
    // Other units need no silo.
    expect(orderErrors(silo(0), idle, 'rl', 1000)).toEqual([]);
  });

  it('needs the price of one unit', () => {
    const price = UNIT.rl!.cost;
    expect(orderErrors(yard({ res: just(price) }), idle, 'rl', 9)).toEqual([]);
    expect(orderErrors(yard({ res: short(price) }), idle, 'rl', 1)).toEqual([
      'cost',
    ]);
  });

  it('holds at most 20 orders', () => {
    const list = (n: number) =>
      yard({ sq: Array.from({ length: n }, () => order) });
    expect(orderErrors(list(19), idle, 'rl', 1)).toEqual([]);
    expect(orderErrors(list(20), idle, 'rl', 1)).toEqual(['queueFull']);
  });

  it('names every reason in the order of the server', () => {
    const none = planet({
      res: poor,
      bq: queue('yard'),
      sq: Array.from({ length: 20 }, () => order),
    });
    expect(orderErrors(none, idle, 'ssd', 0)).toEqual<OrderError[]>([
      'noYard',
      'yardLocked',
      'locked',
      'count',
      'cost',
      'queueFull',
    ]);
    expect(orderErrors(none, idle, 'ssd', 2)).toEqual<OrderError[]>([
      'noYard',
      'yardLocked',
      'locked',
      'limit',
      'cost',
      'queueFull',
    ]);
    expect(orderErrors(none, idle, 'ipm', 1)).toEqual<OrderError[]>([
      'noYard',
      'yardLocked',
      'locked',
      'siloFull',
      'cost',
      'queueFull',
    ]);
  });
});

describe('isProducer', () => {
  it('accepts the producers of the resources page only', () => {
    for (const key of ['metal', 'crystal', 'deut', 'solar', 'fusion', 'sat'])
      expect(isProducer(key), key).toBe(true);
    for (const key of ['lab', 'robot', 'rl', 'energy', 'toString', ''])
      expect(isProducer(key), key).toBe(false);
  });
});

describe('the order of the codes', () => {
  const BUILD_ORDER: readonly BuildError[] = [
    'place',
    'locked',
    'full',
    'busy',
    'yardBusy',
    'labBusy',
    'noEnergy',
    'cost',
  ];
  const RESEARCH_ORDER: readonly ResearchError[] = [
    'off',
    'maxLevel',
    'noLab',
    'locked',
    'busy',
    'labUpgrading',
    'noEnergy',
    'cost',
  ];
  const levels = (keys: string[]) =>
    fc.dictionary(fc.constantFrom(...keys), fc.integer({ min: 0, max: 14 }));
  const states = fc.record({
    kind: fc.constantFrom<Planet['kind']>('planet', 'moon'),
    b: levels(Object.keys(BUILD)),
    research: levels(Object.keys(RES)),
    bq: fc.option(fc.constantFrom(...Object.keys(BUILD))),
    rq: fc.boolean(),
    sq: fc.boolean(),
    res: fc.constantFrom(rich, poor, { m: 5000, c: 5000, d: 5000 }),
    diameter: fc.integer({ min: 1000, max: 15000 }),
  });

  it('lists each code once, in its order, on generated places', () => {
    fc.assert(
      fc.property(
        states,
        fc.constantFrom(...Object.keys(BUILD)),
        fc.constantFrom(...Object.keys(RES)),
        (s, building, study) => {
          const p = planet({
            kind: s.kind,
            b: s.b,
            bq: s.bq === null ? null : queue(s.bq),
            sq: s.sq ? [order] : [],
            res: s.res,
            diameter: s.diameter,
          });
          const r = s.rq
            ? researching(s.research)
            : { research: s.research, rq: null };
          const built = buildErrors(p, r, building, U);
          expect(built).toEqual(BUILD_ORDER.filter((c) => built.includes(c)));
          const studied = researchErrors(p, r, study, U);
          expect(studied).toEqual(
            RESEARCH_ORDER.filter((c) => studied.includes(c)),
          );
        },
      ),
      { seed: 214, numRuns: 200 },
    );
  });
});

// The list of requirements asks the next level of its own entry (F18, #214).
describe('the level a check starts from', () => {
  it('is the level on the planet unless one is given', () => {
    const p = planet({ b: { robot: 2 }, res: just(lvlCost(BUILD.robot!, 3)) });
    expect(buildErrors(p, idle, 'robot', U)).toEqual([]);
    expect(buildErrors(p, idle, 'robot', U, 2)).toEqual([]);
    expect(buildErrors(p, idle, 'robot', U, 3)).toEqual(['cost']);
    expect(buildErrors(p, idle, 'robot', U, 0)).toEqual([]);
    const lean = { ...p, res: short(lvlCost(BUILD.robot!, 3)) };
    expect(buildErrors(lean, idle, 'robot', U)).toEqual(['cost']);
    expect(buildErrors(lean, idle, 'robot', U, 1)).toEqual([]);
  });

  it('is the level researched unless one is given', () => {
    const r: ResearchState = { research: { energy: 2 }, rq: null };
    const p = planet({ b: { lab: 1 }, res: just(lvlCost(RES.energy!, 3)) });
    expect(researchErrors(p, r, 'energy', U)).toEqual([]);
    expect(researchErrors(p, r, 'energy', U, 2)).toEqual([]);
    expect(researchErrors(p, r, 'energy', U, 3)).toEqual(['cost']);
    const lean = { ...p, res: just(lvlCost(RES.energy!, 1)) };
    expect(researchErrors(lean, r, 'energy', U)).toEqual(['cost']);
    expect(researchErrors(lean, r, 'energy', U, 0)).toEqual([]);
  });

  it('costs the level after the one given', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 12 }), (have) => {
        const p = planet({ res: just(lvlCost(BUILD.metal!, have + 1)) });
        expect(buildErrors(p, idle, 'metal', U, have)).toEqual([]);
        const lean = { ...p, res: short(lvlCost(BUILD.metal!, have + 1)) };
        expect(buildErrors(lean, idle, 'metal', U, have)).toEqual(['cost']);
      }),
    );
  });
});
