// The component `consumes` (okf/architecture/patterns.md, sections 1, 3 and
// 12; #114): an entry that uses energy or a resource per hour. Each entry
// brings one rate function per resource; the rule here adds them up in the
// production order of the entry's `produces` (owner, 2026-11-13).
import type { Resources } from '../types.ts';
import type { RateCtx } from './produces.ts';

export interface Consumes {
  /** Energy per hour; the energy factor of the planet follows from it. */
  e?: (c: RateCtx) => number;
  m?: (c: RateCtx) => number;
  c?: (c: RateCtx) => number;
  d?: (c: RateCtx) => number;
}

/** An entry with its `consumes` component, on a planet. */
interface Consumer {
  consumes?: Consumes;
  ctx: RateCtx;
}

/** The energy all consumers need, added up in the production order. */
export const energyUsed = (list: readonly Consumer[]): number =>
  list.reduce((sum, { consumes, ctx }) => {
    const e = consumes?.e;
    return e ? sum + e(ctx) : sum;
  }, 0);

/** `made` per hour of a resource minus every use of it, in the production order. */
export function left(
  made: number,
  list: readonly Consumer[],
  res: keyof Resources,
): number {
  let rest = made;
  for (const { consumes, ctx } of list) {
    const rate = consumes?.[res];
    if (rate) rest -= rate(ctx);
  }
  return rest;
}
