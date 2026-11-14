// Settling with generic events (#115) gives what it gave before: a property
// test on generated planets, queues, research and levels with a fixed seed,
// bit for bit. The reference below is src/core/settle.ts and the throttle
// and accrue part of src/core/economy.ts as they were on main before #115,
// copied unchanged but for the names of the copies; they read prod(),
// caps() and isShip(), which #115 does not change.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { U } from '../test/fixtures.ts';
import { BUILD, isShip, PRODUCERS, RES, SHIPS, UNIT } from './catalog.ts';
import * as E from './economy.ts';
import { caps, prod, type Production } from './economy.ts';
import * as S from './settle.ts';
import type { Levels, Planet, ResearchState, Universe } from './types.ts';

// ---- reference: the throttle and accrue of economy.ts before #115 ----

const KEYS = ['m', 'c', 'd'] as const;

type ProdPlanet = Pick<Planet, 'b' | 'pct' | 'temp'> &
  Partial<Pick<Planet, 'ships'>>;
type StockPlanet = ProdPlanet & Pick<Planet, 'res'>;

const atShare = <P extends ProdPlanet>(p: P, share: number): P => ({
  ...p,
  pct: { ...p.pct, fusion: share },
});

function balancedShare(p: ProdPlanet, u: Universe, research: Levels): number {
  let lo = 0;
  let hi = p.pct.fusion ?? 100;
  for (;;) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) return lo;
    if (prod(atShare(p, mid), u, research).d < 0) hi = mid;
    else lo = mid;
  }
}

function fusionThrottle(
  p: StockPlanet,
  u: Universe,
  research: Levels = {},
): number | null {
  if (p.res.d > 0 || prod(p, u, research).d >= 0) return null;
  return balancedShare(p, u, research);
}

function asRuns<P extends StockPlanet>(p: P, u: Universe, research: Levels): P {
  const share = fusionThrottle(p, u, research);
  return share === null ? p : atShare(p, share);
}

function production(
  p: StockPlanet,
  u: Universe,
  research: Levels = {},
): Production {
  const runs = asRuns(p, u, research);
  const pr = prod(runs, u, research);
  return runs === p ? pr : { ...pr, d: 0 };
}

function addUp(
  p: Planet,
  pr: Production,
  ms: number,
  cp: Record<'m' | 'c' | 'd', number>,
): void {
  const h = ms / 3600000;
  for (const k of KEYS)
    p.res[k] = Math.min(p.res[k] + pr[k] * h, Math.max(p.res[k], cp[k]));
}

const untilEmpty = (stock: number, rate: number): number =>
  rate < 0 ? (stock / -rate) * 3600000 : Infinity;

function accrue(
  p: Planet,
  ms: number,
  u: Universe,
  research: Levels = {},
): void {
  if (ms <= 0) return;
  const pr = prod(p, u, research);
  const cp = caps(p, u);
  const empty = untilEmpty(p.res.d, pr.d);
  if (empty > ms) return addUp(p, pr, ms, cp);
  addUp(p, pr, empty, cp);
  p.res.d = 0;
  addUp(p, production(p, u, research), ms - empty, cp);
}

// ---- reference: src/core/settle.ts before #115 ----

const clone = <T>(o: T): T => structuredClone(o);

function completeBuilding(p: Planet, t: number): void {
  if (p.bq && p.bq.end <= t) {
    p.b[p.bq.key] = p.bq.lvl;
    p.bq = null;
  }
}

function nextSatellite(p: Planet): number {
  if (p.sqT === null) return Infinity;
  let st = p.sqT;
  for (const q of p.sq) {
    if (q.key === 'sat') return st + q.unit;
    st += q.n * q.unit;
  }
  return Infinity;
}

const levelsAt = (r: ResearchState | null | undefined, t: number): Levels =>
  r ? settleR(r, t).research : {};

function techChange(
  p: Planet,
  r: ResearchState | null | undefined,
  t: number,
): number {
  const q = r?.rq;
  const feels = q?.key === 'energy' && (p.b.fusion ?? 0) > 0;
  return feels && q.end > t ? q.end : Infinity;
}

function produce(
  p: Planet,
  from: number,
  until: number,
  u: Universe,
  r: ResearchState | null | undefined,
): void {
  completeBuilding(p, from);
  catchUp(p, from);
  let t = from;
  while (t < until) {
    const e = Math.min(
      until,
      p.bq?.end ?? until,
      nextSatellite(p),
      techChange(p, r, t),
    );
    accrue(p, e - t, u, levelsAt(r, t));
    t = e;
    completeBuilding(p, t);
    catchUp(p, t);
  }
  completeBuilding(p, until);
}

function runShipyard(p: Planet, until: number): void {
  let st = p.sqT ?? until;
  while (p.sq.length > 0) {
    const q = p.sq[0]!;
    const n = Math.min(q.n, Math.floor((until - st) / q.unit));
    if (n > 0) {
      const target = isShip(q.key) ? p.ships : p.def;
      target[q.key] = (target[q.key] ?? 0) + n;
      q.n -= n;
      st += n * q.unit;
    }
    if (q.n > 0) break;
    p.sq.shift();
  }
  p.sqT = p.sq.length ? st : null;
}

function catchUp(p: Planet, t: number): void {
  if (p.sqT !== null) runShipyard(p, t);
}

function settle(
  src: Planet,
  until: number,
  u: Universe,
  r?: ResearchState | null,
): Planet {
  const p = clone(src);
  const from = p.t;
  const end = Math.max(until, from);
  produce(p, from, end, u, r);
  runShipyard(p, end);
  p.t = end;
  return p;
}

function settleR(src: ResearchState, until: number): ResearchState {
  const r = clone(src);
  if (r.rq && r.rq.end <= until) {
    r.research[r.rq.key] = r.rq.lvl;
    r.rq = null;
  }
  return r;
}

/** The planets settleReactors() of actions.ts settled before #115. */
const reactorFeels = (p: Planet, key: string): boolean =>
  key === 'energy' && ((p.b.fusion ?? 0) > 0 || p.bq?.key === 'fusion');

// ---- the property test ----

const H = 3600000;
const BUILDINGS = Object.keys(BUILD);
/** The buildings that make or use a resource, more often than the others. */
const OFTEN = ['metal', 'crystal', 'deut', 'solar', 'fusion'];
const UNITS = Object.keys(UNIT);
const RESEARCH = Object.keys(RES);

const oneOf = <T>(often: readonly T[], all: readonly T[]): fc.Arbitrary<T> =>
  fc.oneof(fc.constantFrom(...often), fc.constantFrom(...all));

const levels = (keys: readonly string[], max: number): fc.Arbitrary<Levels> =>
  fc
    .array(fc.tuple(fc.constantFrom(...keys), fc.integer({ min: 0, max })), {
      maxLength: keys.length,
    })
    .map((pairs) => Object.fromEntries(pairs));

/** A stock: often empty (the throttle), sometimes above any storage limit. */
const amount = fc.oneof(
  fc.constant(0),
  fc.double({ min: 0, max: 5e4, noNaN: true }),
  fc.double({ min: 0, max: 3e6, noNaN: true }),
);
const time = fc.integer({ min: 0, max: 48 * H });

interface Case {
  p: Planet;
  r: ResearchState;
  u: Universe;
  until: number;
  cuts: number[];
}

const cases: fc.Arbitrary<Case> = fc
  .record({
    b: fc.tuple(levels(OFTEN, 16), levels(BUILDINGS, 8)),
    ships: fc.tuple(
      fc.integer({ min: 0, max: 60 }),
      levels(Object.keys(SHIPS), 5),
    ),
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
    res: fc.record({ m: amount, c: amount, d: amount }),
    t: fc.integer({ min: 0, max: H }),
    bq: fc.option(
      fc.record({
        key: oneOf(['fusion', 'deut', 'solar'], BUILDINGS),
        end: time,
      }),
    ),
    sq: fc.array(
      fc.record({
        key: oneOf(['sat'], UNITS),
        n: fc.integer({ min: 0, max: 5 }),
        unit: fc.integer({ min: 1, max: 10 * H }),
      }),
      { maxLength: 4 },
    ),
    sqT: fc.option(fc.integer({ min: 0, max: 2 * H })),
    research: levels(RESEARCH, 12),
    rq: fc.option(fc.record({ key: oneOf(['energy'], RESEARCH), end: time })),
    speed: fc.oneof(fc.constant(1), fc.integer({ min: 1, max: 10 })),
    until: fc.integer({ min: 0, max: 60 * H }),
    cuts: fc.array(fc.integer({ min: 0, max: 60 * H }), { maxLength: 3 }),
  })
  .map((x) => {
    const b = { ...x.b[1], ...x.b[0] };
    const p: Planet = {
      id: 'p1_1_5',
      kind: 'planet',
      owner: 'u1',
      name: 'Heimat',
      g: 1,
      s: 1,
      p: 5,
      temp: x.temp,
      diameter: 12800,
      unlimited: false,
      res: x.res,
      b,
      ships: { ...x.ships[1], sat: x.ships[0] },
      def: {},
      // A level that is built is the next one (actions.ts).
      bq: x.bq && {
        key: x.bq.key,
        lvl: (b[x.bq.key] ?? 0) + 1,
        start: 0,
        end: x.bq.end,
        cost: [1, 1, 1],
      },
      sq: x.sq,
      sqT: x.sq.length ? x.sqT : null,
      pct: x.pct,
      t: x.t,
      created: 0,
    };
    const r: ResearchState = {
      research: x.research,
      rq: x.rq && {
        key: x.rq.key,
        lvl: (x.research[x.rq.key] ?? 0) + 1,
        start: 0,
        end: x.rq.end,
        cost: [0, 0, 0],
      },
    };
    return {
      p,
      r,
      u: { ...U, speed: x.speed },
      until: x.until,
      cuts: [...x.cuts].sort((a, b) => a - b),
    };
  });

/** What settling gives in steps at `cuts` and then at `until`: every step. */
function steps(
  c: Case,
  run: (p: Planet, t: number, u: Universe, r?: ResearchState) => Planet,
): Planet[] {
  const out: Planet[] = [];
  let p = c.p;
  for (const t of [...c.cuts, c.until]) {
    p = run(p, t, c.u, c.r);
    out.push(p);
  }
  return out;
}

/** The events a case meets, by the reference: whether the generated cases reach them all. */
function eventsOf(c: Case): string[] {
  const p = c.p;
  const done = settle(p, c.until, c.u, c.r);
  const q = c.r.rq;
  const bq = p.bq;
  const ran = (end: number): boolean => end > p.t && end <= c.until;
  const met: Record<string, boolean> = {
    throttle: fusionThrottle(p, c.u, c.r.research) !== null,
    empty: done.res.d === 0 && p.res.d > 0,
    building: bq !== null && ran(bq.end),
    research: q !== null && ran(q.end) && reactorFeels(p, q.key),
    satellite: (done.ships.sat ?? 0) > (p.ships.sat ?? 0),
    'storage limit': KEYS.some((k) => done.res[k] === caps(done, c.u)[k]),
  };
  return Object.keys(met).filter((k) => met[k]);
}

const RUNS = 300;
// Slow under the coverage instrumentation of Stryker: its own time limit.
const TIMEOUT = 120_000;

describe(
  'settling with generic events (#115) against the code before',
  { timeout: TIMEOUT },
  () => {
    it('settles in one step and in steps bit for bit', () => {
      fc.assert(
        fc.property(cases, (c) => {
          expect(S.settle(c.p, c.until, c.u, c.r)).toStrictEqual(
            settle(c.p, c.until, c.u, c.r),
          );
          expect(S.settle(c.p, c.until, c.u)).toStrictEqual(
            settle(c.p, c.until, c.u),
          );
          expect(steps(c, S.settle)).toStrictEqual(steps(c, settle));
        }),
        { seed: 115, numRuns: RUNS },
      );
    });

    it('accrues and produces bit for bit, with the throttled share of before', () => {
      fc.assert(
        fc.property(cases, (c) => {
          const research = c.r.research;
          const now = clone(c.p);
          const old = clone(c.p);
          E.accrue(now, c.until, c.u, research);
          accrue(old, c.until, c.u, research);
          expect(now).toStrictEqual(old);
          expect(E.production(c.p, c.u, research)).toStrictEqual(
            production(c.p, c.u, research),
          );
          expect(E.throttle(c.p, c.u, research)?.share ?? null).toBe(
            fusionThrottle(c.p, c.u, research),
          );
        }),
        { seed: 115, numRuns: RUNS },
      );
    });

    it('names the planets settleReactors() settled', () => {
      fc.assert(
        fc.property(cases, (c) => {
          for (const key of RESEARCH)
            expect(S.feelsResearch(c.p, c.u, c.r.research, key), key).toBe(
              reactorFeels(c.p, key),
            );
        }),
        { seed: 115, numRuns: RUNS },
      );
    });

    it('meets every event in the generated cases', () => {
      const met = new Set<string>();
      fc.assert(
        fc.property(cases, (c) => {
          for (const e of eventsOf(c)) met.add(e);
        }),
        { seed: 115, numRuns: RUNS },
      );
      expect([...met].sort()).toEqual([
        'building',
        'empty',
        'research',
        'satellite',
        'storage limit',
        'throttle',
      ]);
    });
  },
);

/** The tolerance of #47 for settling in steps (okf/features/fusion-reactor.md). */
const close = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-6 + 1e-9 * Math.abs(b);

describe(
  'settling with generic events (#115): split, stock and storage limit',
  { timeout: TIMEOUT },
  () => {
    it('gives the same planet in one step or in steps, the stocks within the tolerance of #47', () => {
      // Not bit for bit: version 1 adds the production of two segments
      // with two roundings too. A shipyard without a start time starts when
      // it is settled, so the property needs one that has started.
      fc.assert(
        fc.property(cases, (c) => {
          fc.pre(c.p.sqT !== null || c.p.sq.length === 0);
          const once = S.settle(c.p, c.until, c.u, c.r);
          const cuts = c.cuts.filter((t) => t <= c.until);
          const last = steps({ ...c, cuts }, S.settle).at(-1)!;
          for (const k of KEYS)
            expect(close(last.res[k], once.res[k]), k).toBe(true);
          expect({ ...last, res: null }).toStrictEqual({ ...once, res: null });
        }),
        { seed: 115, numRuns: RUNS },
      );
    });

    it('never takes a stock below 0 nor lets it grow above its storage limit', () => {
      fc.assert(
        fc.property(cases, (c) => {
          for (const p of steps(c, S.settle)) {
            const cp = caps(p, c.u);
            for (const k of KEYS) {
              expect(p.res[k], k).toBeGreaterThanOrEqual(0);
              expect(p.res[k], k).toBeLessThanOrEqual(
                Math.max(c.p.res[k], cp[k]),
              );
            }
          }
        }),
        { seed: 115, numRuns: RUNS },
      );
    });
  },
);
