// The component `unit` (okf/architecture/patterns.md, sections 1 and 12;
// #114): an entry that is built in pieces, ships and defense, the
// counterpart of `leveled`. It holds the cost of one piece (owner,
// 2026-11-13). The requirements stay in the entry's `def`, "once per planet"
// is in `limit` and the flight fields are in `mobile`. The hull of a
// piece follows from its cost in the rule of `combat`.
import type { Cost } from '../types.ts';

export interface Unit {
  /** Cost of one piece: Adamant, Psikristall, Promethium. */
  cost: Cost;
}

/**
 * The Adamant and Psikristall of `n` pieces, what destroyed ships leave
 * for a Trümmerfeld before its share (#45); Promethium leaves nothing.
 */
export const wreck = (u: Unit, n: number): { m: number; c: number } => ({
  m: u.cost[0] * n,
  c: u.cost[1] * n,
});
