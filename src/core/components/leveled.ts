// The component `leveled` (okf/architecture/patterns.md, sections 1 and 12;
// #114): an entry that is built or researched in levels, buildings and
// research. Its cost is the cost of level 1; every further level costs `f`
// times as much, rounded down. Research has no factor of its own: the
// default 2 stays here, not in the data (owner, 2026-11-13).
import type { Cost } from '../types.ts';

export interface Leveled {
  /** Cost of level 1: Adamant, Psikristall, Promethium. */
  cost: Cost;
  /** Factor per level; 2 when it is not set. */
  f?: number;
}

/** The cost of level `level`. */
export const lvlCost = (d: Leveled, level: number): Cost => {
  const f = d.f ?? 2;
  const [m, c, de] = d.cost.map((x) => Math.floor(x * Math.pow(f, level - 1)));
  return [m ?? 0, c ?? 0, de ?? 0];
};

/** The cost of all levels up to `level`, the three resources added up. */
export function sumLevels(d: Leveled, level: number): number {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    const c = lvlCost(d, i);
    total += c[0] + c[1] + c[2];
  }
  return total;
}
