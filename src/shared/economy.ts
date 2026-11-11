// Costs, times, production and storage. A straight port of the original
// formulas; the universe settings come in as a parameter.
import { BUILD, RES } from './catalog.ts';
import type {
  Cost,
  Levels,
  Planet,
  Requirements,
  ResearchState,
  Universe,
} from './types.ts';

const KEYS = ['m', 'c', 'd'] as const;

export const lvlCost = (d: { cost: Cost; f?: number }, level: number): Cost => {
  const f = d.f ?? 2;
  const [m, c, de] = d.cost.map((x) => Math.floor(x * Math.pow(f, level - 1)));
  return [m ?? 0, c ?? 0, de ?? 0];
};

export const capOf = (level: number, u: Universe): number =>
  u.baseStore + 50000 * (Math.ceil(Math.pow(1.6, level)) - 1);

export function sumLevels(
  d: { cost: Cost; f?: number },
  level: number,
): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    const c = lvlCost(d, i);
    total += c[0] + c[1] + c[2];
  }
  return total;
}

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

const missing = (
  need: Levels | undefined,
  have: Levels,
  names: Record<string, { n: string }>,
): string[] =>
  Object.entries(need ?? {})
    .filter(([k, l]) => lv(have, k) < l)
    .map(([k, l]) => `${names[k]?.n ?? k} (Stufe ${l})`);

/** Names of the requirements that are not met, for example "Forschungslabor (Stufe 3)". */
export function reqMissing(
  d: { req?: Requirements },
  p: Pick<Planet, 'b'>,
  r: Pick<ResearchState, 'research'>,
): string[] {
  return [
    ...missing(d.req?.b, p.b, BUILD),
    ...missing(d.req?.r, r.research, RES),
  ];
}

export interface Production {
  m: number;
  c: number;
  d: number;
  eProd: number;
  eUse: number;
  f: number;
}

const growth = (l: number): number => l * Math.pow(1.1, l);

export function prod(
  p: Pick<Planet, 'b' | 'pct' | 'temp'>,
  u: Universe,
): Production {
  const g = (k: string): number => growth(lv(p.b, k));
  const pc = (k: string): number => (p.pct[k] ?? 100) / 100;
  // The order of the factors is the one of the original formulas, so the
  // floating point results are the same to the last digit.
  const eProd = 20 * g('solar') * pc('solar');
  const eUse =
    10 * g('metal') * pc('metal') +
    10 * g('crystal') * pc('crystal') +
    20 * g('deut') * pc('deut');
  const f = eUse <= 0 ? 1 : Math.min(1, eProd / eUse);
  const sp = u.speed;
  return {
    m: (20 + 30 * g('metal') * pc('metal') * f) * sp,
    c: (10 + 20 * g('crystal') * pc('crystal') * f) * sp,
    d: Math.max(
      0,
      10 * g('deut') * (1.28 - 0.002 * (p.temp || 20)) * pc('deut') * f * sp,
    ),
    eProd,
    eUse,
    f,
  };
}

export const caps = (
  p: Pick<Planet, 'b'>,
  u: Universe,
): Record<'m' | 'c' | 'd', number> => ({
  m: capOf(lv(p.b, 'smetal'), u),
  c: capOf(lv(p.b, 'scrystal'), u),
  d: capOf(lv(p.b, 'sdeut'), u),
});

/** Adds the production of `ms` milliseconds, up to the storage limit. */
export function accrue(p: Planet, ms: number, u: Universe): void {
  if (ms <= 0) return;
  const pr = prod(p, u);
  const cp = caps(p, u);
  const h = ms / 3600000;
  for (const k of KEYS)
    if (p.res[k] < cp[k]) p.res[k] = Math.min(cp[k], p.res[k] + pr[k] * h);
}
