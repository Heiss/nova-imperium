// The component `locks` (okf/architecture/patterns.md, sections 1 and 12;
// #183): a building whose upgrade stops something while it runs, and whose
// upgrade waits until that thing is idle. The Schiffsschmiede and the
// Machina-Schwarmhalle stop the shipyard (#48, D1), the Scholarium stops the
// research (#49). Three entries share it, so it is a component (owner,
// 2026-11-14: „Lab lock and shipyard lock without catalog keys“); the lab
// rules in `lab.ts` and the shipyard rules in `yard.ts` read it through this
// module and name no key.

/** What an upgrade can stop: the orders of the shipyard, or the research. */
export type Lock = 'shipyard' | 'research';

export interface Locks {
  /** What stops while this building is upgraded and what its upgrade waits for. */
  stops: Lock;
  /**
   * The building is the place of what it stops: the shipyard of the
   * Schiffsschmiede, the lab of the Scholarium. Exactly one building per
   * kind of lock has it; a ship, a defense or a research needs its level.
   */
  home?: true;
}

/** The buildings with a `locks` component, by key. */
type Table = Readonly<Record<string, Locks>>;

/** The locks of a building; undefined for any other key, inherited names included. */
const lockOf = (table: Table, key: string): Locks | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/** Whether an upgrade of `key` stops `what`. */
export const stops = (table: Table, key: string, what: Lock): boolean =>
  lockOf(table, key)?.stops === what;

/** The keys of the buildings that stop `what`, in the order of the table. */
export const stoppers = (table: Table, what: Lock): string[] =>
  Object.entries(table).flatMap(([key, l]) => (l.stops === what ? [key] : []));

/** The building that is the place of `what`, or undefined when none is. */
export const homeOf = (table: Table, what: Lock): string | undefined =>
  Object.entries(table).find(([, l]) => l.stops === what && l.home)?.[0];
