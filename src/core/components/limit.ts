// The component `limit` (okf/architecture/patterns.md, sections 1 and 12;
// #114): at most `perPlanet` pieces of an entry per planet, the stock and
// the shipyard queue together; both shield domes carry 1 (#50, D3; owner,
// 2026-11-14). Only this module reads the component; yard.ts asks it for
// the room a planet has left.

export interface Limit {
  /** The most pieces a planet may have, counting the shipyard queue. */
  perPlanet: number;
}

/**
 * How many more pieces a planet may order: `perPlanet` minus the pieces it
 * has and those in the queue, never below 0; Infinity without a limit.
 */
export const room = (
  limit: Limit | undefined,
  have: number,
  queued: number,
): number => (limit ? Math.max(0, limit.perPlanet - have - queued) : Infinity);
