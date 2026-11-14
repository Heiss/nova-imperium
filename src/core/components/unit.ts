// The component `unit` (okf/architecture/patterns.md, sections 1 and 12;
// #114): an entry that is built in pieces, ships and defense, the
// counterpart of `leveled`. It holds the cost of one piece (owner,
// 2026-11-13). The requirements stay in the entry's `def`, "once per planet"
// waits for `limit` and the flight fields are in `mobile`. The hull of a
// piece follows from its cost in the rule of `combat`.
import type { Cost } from '../types.ts';

export interface Unit {
  /** Cost of one piece: Adamant, Psikristall, Promethium. */
  cost: Cost;
}
