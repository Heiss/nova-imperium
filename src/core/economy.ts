// Costs, times, production and storage. A straight port of the original
// formulas; the universe settings come in as a parameter. Production and
// storage come from the components of the entries (#114).
import { PRODUCTION, STORAGE } from './catalog.ts';
import { energyUsed, left } from './components/consumes.ts';
import {
  BASE_INCOME,
  energyMade,
  made,
  type MineCtx,
} from './components/produces.ts';
import { capacities } from './components/storage.ts';
import { satsEnergy } from './rates.ts';
import { text } from './text.ts';
import type {
  Cost,
  Levels,
  Planet,
  Requirements,
  ResearchState,
  Resources,
  Universe,
} from './types.ts';

export { lvlCost, sumLevels } from './components/leveled.ts';
export { capOf } from './components/storage.ts';
export { fusionEnergy, fusionUse, satEnergy } from './rates.ts';

const KEYS = ['m', 'c', 'd'] as const;

const hours = (h: number, u: Universe): number =>
  Math.ceil((h * 3600000) / u.speed);
const lv = (levels: Levels, key: string): number => levels[key] ?? 0;
const MIN_TIME = 1000;

/** Each level of the Nanitenfabrik halves building and shipyard times (#48). */
const nanite = (p: Pick<Planet, 'b'>): number => Math.pow(2, lv(p.b, 'nanite'));

export const buildTime = (c: Cost, p: Pick<Planet, 'b'>, u: Universe): number =>
  Math.max(
    MIN_TIME,
    hours((c[0] + c[1]) / (2500 * (1 + lv(p.b, 'robot')) * nanite(p)), u),
  );

export const researchTime = (
  c: Cost,
  p: Pick<Planet, 'b'>,
  u: Universe,
): number =>
  Math.max(MIN_TIME, hours((c[0] + c[1]) / (1000 * (1 + lv(p.b, 'lab'))), u));

export const unitTime = (
  d: { cost: Cost },
  p: Pick<Planet, 'b'>,
  u: Universe,
): number =>
  Math.max(
    MIN_TIME,
    hours(
      (d.cost[0] + d.cost[1]) / (2500 * (1 + lv(p.b, 'yard')) * nanite(p)),
      u,
    ),
  );

export const afford = (p: Pick<Planet, 'res'>, c: Cost, n = 1): boolean =>
  p.res.m >= c[0] * n && p.res.c >= c[1] * n && p.res.d >= c[2] * n;

export const pay = (p: Pick<Planet, 'res'>, c: Cost, n = 1): void => {
  p.res.m -= c[0] * n;
  p.res.c -= c[1] * n;
  p.res.d -= c[2] * n;
};

export const refund = (p: Pick<Planet, 'res'>, c: Cost): void => pay(p, c, -1);

export const maxAfford = (p: Pick<Planet, 'res'>, c: Cost): number =>
  Math.floor(
    Math.min(...KEYS.map((k, i) => (c[i] ? p.res[k] / (c[i] ?? 1) : Infinity))),
  );

const missing = (need: Levels | undefined, have: Levels): string[] =>
  Object.entries(need ?? {})
    .filter(([k, l]) => lv(have, k) < l)
    .map(([k, l]) => `${text(k)?.n ?? k} (Stufe ${l})`);

/** Names of the requirements that are not met, for example "Forschungslabor (Stufe 3)". */
export function reqMissing(
  d: { req?: Requirements },
  p: Pick<Planet, 'b'>,
  r: Pick<ResearchState, 'research'>,
): string[] {
  return [...missing(d.req?.b, p.b), ...missing(d.req?.r, r.research)];
}

export interface Production {
  m: number;
  c: number;
  d: number;
  eProd: number;
  eUse: number;
  f: number;
}

type ProdPlanet = Pick<Planet, 'b' | 'pct' | 'temp'> &
  Partial<Pick<Planet, 'ships'>>;

/** Energy of all Solarsatelliten of a planet at their production share. */
export const satPower = (p: ProdPlanet): number =>
  satsEnergy(p.ships?.sat ?? 0, p.temp, p.pct.sat ?? 100);

/** The entries with production components on a planet, in the production order. */
const running = (p: ProdPlanet, u: Universe, research: Levels) =>
  PRODUCTION.map(({ key, kind, produces, consumes }) => ({
    key,
    kind,
    produces,
    consumes,
    ctx: {
      // The level of a ship is its number on the planet.
      level: kind === 'ship' ? (p.ships?.[key] ?? 0) : lv(p.b, key),
      pct: p.pct[key] ?? 100,
      temp: p.temp,
      research,
      u,
    },
  }));

type Running = ReturnType<typeof running>;

/** The energy made and used and the energy factor `f` of the mines. */
function factor(list: Running): Pick<Production, 'eProd' | 'eUse' | 'f'> {
  const eProd = energyMade(list);
  const eUse = energyUsed(list);
  return { eProd, eUse, f: eUse <= 0 ? 1 : Math.min(1, eProd / eUse) };
}

/**
 * Production per hour at the set shares, from the `produces` and `consumes`
 * components of the entries (#114). `research` holds the levels of the
 * owner; only the Fusionskraftwerk reads one (Energietechnik). The sums run
 * in the production order, which is the order of the factors of the
 * original formulas, so the floating point results are those of version 1
 * to the last digit; the Fusionskraftwerk adds 0 when there is none.
 */
export function prod(
  p: ProdPlanet,
  u: Universe,
  research: Levels = {},
): Production {
  const list = running(p, u, research);
  const { eProd, eUse, f } = factor(list);
  const net = (res: 'm' | 'c' | 'd'): number =>
    left(made(list, res, f, u), list, res);
  return { m: net('m'), c: net('c'), d: net('d'), eProd, eUse, f };
}

type StockPlanet = ProdPlanet & Pick<Planet, 'res'>;
type Stock = keyof Resources;

/**
 * The entries that use a stock resource, each with that resource (#115):
 * when the stock is empty and would fall, this consumer is throttled. The
 * contract test of `consumes` allows one: how several consumers would share
 * an empty stock is not decided.
 */
export const STOCK_USERS: readonly { key: string; res: Stock }[] =
  PRODUCTION.flatMap(({ key, consumes }) =>
    KEYS.filter((res) => consumes?.[res]).map((res) => ({ key, res })),
  );

/** A consumer at an empty stock: its key, the resource and the share in % it runs at. */
export interface Throttle {
  key: string;
  res: Stock;
  share: number;
}

const atShare = <P extends ProdPlanet>(
  p: P,
  key: string,
  share: number,
): P => ({
  ...p,
  pct: { ...p.pct, [key]: share },
});

/**
 * The share in % at which the consumer `key` uses exactly the `res` the
 * planet produces (#47 D1), between 0 and its set share. Its energy raises
 * the mine factor `f` and with it the production of `res`, so the share is
 * a fixed point. The net production N(s) = D(s) − U(s) is concave in the
 * share s: D grows with `f`, which is min(1, linear in s), U is linear.
 * With N(0) ≥ 0 > N(set share) there is exactly one crossing; bisection
 * finds it to the precision of the floating point numbers and returns the
 * side where N ≥ 0, so the stock never falls. The only own mathematics of
 * the economy (okf/architecture/patterns.md, section 3).
 */
export function balancedShare(
  p: ProdPlanet,
  u: Universe,
  research: Levels,
  { key, res }: Omit<Throttle, 'share'>,
): number {
  let lo = 0;
  let hi = p.pct[key] ?? 100;
  for (;;) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) return lo;
    if (prod(atShare(p, key, mid), u, research)[res] < 0) hi = mid;
    else lo = mid;
  }
}

/** The consumer that runs throttled, or null when all run at their set share: only an empty stock that would fall throttles its consumer (#47 D1, #115). */
export function throttle(
  p: StockPlanet,
  u: Universe,
  research: Levels = {},
): Throttle | null {
  for (const user of STOCK_USERS) {
    if (p.res[user.res] > 0 || prod(p, u, research)[user.res] >= 0) continue;
    return { ...user, share: balancedShare(p, u, research, user) };
  }
  return null;
}

/** The planet as it runs now: with a consumer at its throttled share, if any. */
function asRuns<P extends StockPlanet>(p: P, u: Universe, research: Levels): P {
  const t = throttle(p, u, research);
  return t === null ? p : atShare(p, t.key, t.share);
}

/** Production per hour as it runs now: with a throttled consumer its empty stock stays at 0. */
export function production(
  p: StockPlanet,
  u: Universe,
  research: Levels = {},
): Production {
  const t = throttle(p, u, research);
  if (t === null) return prod(p, u, research);
  return { ...prod(atShare(p, t.key, t.share), u, research), [t.res]: 0 };
}

/** Energy or a resource: what an entry makes or uses per hour. */
type Flow = Partial<Record<keyof Resources | 'e', number>>;

/** One producer on the resources page (#114). */
export interface ProducerRow {
  key: string;
  kind: Running[number]['kind'];
  /** The level of a building, the number of a ship. */
  level: number;
  /** The share in % it runs at: the set one, or the throttled one. */
  pct: number;
  /** Whether it runs below its set share (#47 D1). */
  throttled: boolean;
  /** Made per hour; a resource times the universe speed, as in prod(). */
  made: Flow;
  /** Used per hour, as prod() subtracts it. */
  used: Flow;
}

/** The rates of `fns` on `ctx` that exist, each times `times`. */
function rates<C>(
  fns: Partial<Record<keyof Flow, (c: C) => number>> | undefined,
  ctx: C,
  keys: readonly (keyof Flow)[],
  times = 1,
): Flow {
  const out: Flow = {};
  for (const r of keys) {
    const rate = fns?.[r];
    if (rate) out[r] = rate(ctx) * times;
  }
  return out;
}

function producerRow(
  { key, kind, produces, consumes, ctx }: Running[number],
  f: number,
  set: number,
): ProducerRow {
  const mine: MineCtx = { ...ctx, f };
  return {
    key,
    kind,
    level: ctx.level,
    pct: ctx.pct,
    throttled: ctx.pct !== set,
    made: {
      ...rates(produces, mine, KEYS, ctx.u.speed),
      ...rates(produces, mine, ['e']),
    },
    used: rates(consumes, ctx, [...KEYS, 'e']),
  };
}

/**
 * The rows of the resources page (#114): the base income and every entry
 * with production components, in the production order, from the same list,
 * energy factor `f` and throttled share as production(). The rows add up
 * to prod() of the planet as it runs; the browser computes no formula.
 */
export function producerRows(
  p: StockPlanet,
  u: Universe,
  research: Levels = {},
): { f: number; base: Resources; rows: ProducerRow[] } {
  const list = running(asRuns(p, u, research), u, research);
  const { f } = factor(list);
  return {
    f,
    base: {
      m: BASE_INCOME.m * u.speed,
      c: BASE_INCOME.c * u.speed,
      d: BASE_INCOME.d * u.speed,
    },
    rows: list.map((x) => producerRow(x, f, p.pct[x.key] ?? 100)),
  };
}

/** What an entry uses per hour of each resource at `level` and its set share, from its `consumes` (#114). */
export function useAt(
  key: string,
  level: number,
  p: ProdPlanet,
  u: Universe,
  research: Levels = {},
): Partial<Resources> {
  const x = running(p, u, research).find((e) => e.key === key);
  return x ? rates(x.consumes, { ...x.ctx, level }, KEYS) : {};
}

/** Energy per hour of one piece of a ship with `produces` on `p`, at full share; undefined for any other key (#114). */
export function pieceEnergy(
  key: string,
  p: Pick<Planet, 'temp'>,
  u: Universe,
  research: Levels = {},
): number | undefined {
  const x = PRODUCTION.find((e) => e.key === key && e.kind === 'ship');
  return x?.produces.e?.({ level: 1, pct: 100, temp: p.temp, research, u });
}

/** The storage limits of a planet, from the `storage` components (#114). */
export const caps = (
  p: Pick<Planet, 'b'>,
  u: Universe,
): Record<'m' | 'c' | 'd', number> => capacities(STORAGE, p.b, u);

/** Adds `ms` milliseconds of `pr`: growth up to the storage limit, a use at any stock. */
function addUp(
  p: Planet,
  pr: Production,
  ms: number,
  cp: Record<'m' | 'c' | 'd', number>,
): void {
  const h = ms / 3600000;
  // Growth stops at the storage limit (a stock above it stays), a use lowers
  // any stock: min(stock + change, max(stock, limit)) covers both.
  for (const k of KEYS)
    p.res[k] = Math.min(p.res[k] + pr[k] * h, Math.max(p.res[k], cp[k]));
}

/** Milliseconds until a falling stock is empty; Infinity when it does not fall. */
const untilEmpty = (stock: number, rate: number): number =>
  rate < 0 ? (stock / -rate) * 3600000 : Infinity;

/** The first stock of `STOCK_USERS` that a rate empties, with the milliseconds until then; null when none falls. */
function firstEmpty(
  p: Planet,
  pr: Production,
): { res: Stock; ms: number } | null {
  let first: { res: Stock; ms: number } | null = null;
  for (const { res } of STOCK_USERS) {
    const ms = untilEmpty(p.res[res], pr[res]);
    if (ms < (first?.ms ?? Infinity)) first = { res, ms };
  }
  return first;
}

/**
 * Adds the production of `ms` milliseconds, up to the storage limit. When a
 * use empties a stock, the time is split there (a generic event of #115)
 * and the rest runs with its consumer throttled (#47 D1), so the result
 * does not depend on how often the planet is settled. A stock that reaches
 * its storage limit stops there inside the segment (`addUp`): no rate
 * depends on a full stock, so it splits nothing and the order of the
 * floating point operations stays the one of version 1.
 */
export function accrue(
  p: Planet,
  ms: number,
  u: Universe,
  research: Levels = {},
): void {
  if (ms <= 0) return;
  const pr = prod(p, u, research);
  const cp = caps(p, u);
  const empty = firstEmpty(p, pr);
  if (empty === null || empty.ms > ms) return addUp(p, pr, ms, cp);
  addUp(p, pr, empty.ms, cp);
  p.res[empty.res] = 0;
  addUp(p, production(p, u, research), ms - empty.ms, cp);
}

/**
 * Whether a rate of an entry on the planet (its level or number above 0)
 * reads the research `key` (#115): then the end of that research changes
 * the production, as Energietechnik changes a Fusionskraftwerk (#47). The
 * rates run once on research levels that note every level read.
 */
export function readsResearch(
  p: ProdPlanet,
  u: Universe,
  research: Levels,
  key: string,
): boolean {
  const read = new Set<string | symbol>();
  const noted = new Proxy(research, {
    get(levels, k) {
      read.add(k);
      return Reflect.get(levels, k) as unknown;
    },
  });
  for (const { produces, consumes, ctx } of running(p, u, noted)) {
    if (ctx.level <= 0) continue;
    const fns = [...Object.values(produces), ...Object.values(consumes ?? {})];
    for (const rate of fns)
      if (typeof rate === 'function') rate({ ...ctx, f: 1 });
  }
  return read.has(key);
}
