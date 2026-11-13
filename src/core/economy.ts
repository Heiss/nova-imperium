// Costs, times, production and storage. A straight port of the original
// formulas; the universe settings come in as a parameter. Production and
// storage come from the components of the entries (#114).
import { PRODUCTION, STORAGE } from './catalog.ts';
import { energyUsed, left } from './components/consumes.ts';
import { energyMade, made } from './components/produces.ts';
import { capacities } from './components/storage.ts';
import { satsEnergy } from './rates.ts';
import { text } from './text.ts';
import type {
  Cost,
  Levels,
  Planet,
  Requirements,
  ResearchState,
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
  const eProd = energyMade(list);
  const eUse = energyUsed(list);
  const f = eUse <= 0 ? 1 : Math.min(1, eProd / eUse);
  const net = (res: 'm' | 'c' | 'd'): number =>
    left(made(list, res, f, u), list, res);
  return { m: net('m'), c: net('c'), d: net('d'), eProd, eUse, f };
}

type StockPlanet = ProdPlanet & Pick<Planet, 'res'>;

const atShare = <P extends ProdPlanet>(p: P, share: number): P => ({
  ...p,
  pct: { ...p.pct, fusion: share },
});

/**
 * The share in % at which the Fusionskraftwerk uses exactly the deuterium
 * the planet produces (#47 D1), between 0 and its set share. Its energy
 * raises the mine factor `f` and with it the deuterium production, so the
 * share is a fixed point. The net deuterium production N(s) = D(s) − U(s)
 * is concave in the share s: D grows with `f`, which is min(1, linear in
 * s), U is linear. With N(0) ≥ 0 > N(set share) there is exactly one
 * crossing; bisection finds it to the precision of the floating point
 * numbers and returns the side where N ≥ 0, so the stock never falls.
 */
export function balancedShare(
  p: ProdPlanet,
  u: Universe,
  research: Levels,
): number {
  let lo = 0;
  let hi = p.pct.fusion ?? 100;
  for (;;) {
    const mid = (lo + hi) / 2;
    if (mid === lo || mid === hi) return lo;
    if (prod(atShare(p, mid), u, research).d < 0) hi = mid;
    else lo = mid;
  }
}

/** The throttled share in % of the Fusionskraftwerk, or null when it runs at its set share: only an empty stock that would fall throttles it (#47 D1). */
export function fusionThrottle(
  p: StockPlanet,
  u: Universe,
  research: Levels = {},
): number | null {
  if (p.res.d > 0 || prod(p, u, research).d >= 0) return null;
  return balancedShare(p, u, research);
}

/** Production per hour as it runs now: with a throttled Fusionskraftwerk the deuterium stays at 0. */
export function production(
  p: StockPlanet,
  u: Universe,
  research: Levels = {},
): Production {
  const share = fusionThrottle(p, u, research);
  if (share === null) return prod(p, u, research);
  return { ...prod(atShare(p, share), u, research), d: 0 };
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

/**
 * Adds the production of `ms` milliseconds, up to the storage limit. When a
 * Fusionskraftwerk empties the deuterium stock, the time is split there
 * and the rest runs with the throttled reactor (#47 D1), so the result
 * does not depend on how often the planet is settled.
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
  const empty = untilEmpty(p.res.d, pr.d);
  if (empty > ms) return addUp(p, pr, ms, cp);
  addUp(p, pr, empty, cp);
  p.res.d = 0;
  addUp(p, production(p, u, research), ms - empty, cp);
}
