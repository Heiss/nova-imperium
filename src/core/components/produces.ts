// The component `produces` (okf/architecture/patterns.md, sections 1, 3 and
// 12; #114): an entry that adds energy or a resource per hour. Each entry
// brings one rate function per resource; the rule here adds them up in the
// production order, so the floating point order of version 1 stays and
// prod() is bit-identical (owner, 2026-11-13).
import type { Levels, Resources, Universe } from '../types.ts';

/** What a rate function knows about its entry on a planet. */
export interface RateCtx {
  /** The level of a building, the number of a ship. */
  level: number;
  /** The production share the player set, in % (100 when not set). */
  pct: number;
  /** The maximum temperature of the planet. */
  temp: number;
  /** The research levels of the owner. */
  research: Levels;
  u: Universe;
}

/** A resource rate also knows the energy factor `f` of the planet. */
export interface MineCtx extends RateCtx {
  f: number;
}

export interface Produces {
  /** The place in the production order: the order of the sums, and of the shares on the resources page. */
  order: number;
  /** Energy per hour; it does not depend on the energy factor. */
  e?: (c: RateCtx) => number;
  m?: (c: MineCtx) => number;
  c?: (c: MineCtx) => number;
  d?: (c: MineCtx) => number;
}

/** An entry with its `produces` component, on a planet. */
interface Producer {
  produces: Produces;
  ctx: RateCtx;
}

/** The base income per hour without any building, before the universe speed. */
export const BASE_INCOME: Resources = { m: 20, c: 10, d: 0 };

/** The energy all producers make, added up in the production order. */
export const energyMade = (list: readonly Producer[]): number =>
  list.reduce((sum, { produces, ctx }) => {
    const e = produces.e;
    return e ? sum + e(ctx) : sum;
  }, 0);

/**
 * The production of one resource per hour: the base income plus every
 * rate in the production order, times the universe speed, never below 0.
 */
export function made(
  list: readonly Producer[],
  res: keyof Resources,
  f: number,
  u: Universe,
): number {
  let sum = BASE_INCOME[res];
  for (const { produces, ctx } of list) {
    const rate = produces[res];
    if (rate) sum += rate({ ...ctx, f });
  }
  return Math.max(0, sum * u.speed);
}
