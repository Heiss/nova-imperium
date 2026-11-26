// The system the Sternenkarte shows (#405, owner, 2026-11-26, 151a): while
// the map is open, the browser names it with its requests for the state and
// its actions (`galaxy=g:s`), and the state answers which owners there the
// noob protection covers, by the exact points of the server, never the
// stored pass. Without the name nothing is computed.
import type { Universe } from './types.ts';

/** A system of the universe: galaxy and system. */
export interface ShownSystem {
  g: number;
  s: number;
}

/** The owners of the shown system that the noob protection covers against the player. */
export interface ShownProtection extends ShownSystem {
  owners: string[];
}

/** The name of a system in a request: „g:s“. */
export const shownParam = ({ g, s }: ShownSystem): string => `${g}:${s}`;

const inRange = (n: number, most: number): boolean =>
  Number.isSafeInteger(n) && n >= 1 && n <= most;

/** The system a request names, or null for none or anything else. */
export function shownSystemOf(
  raw: unknown,
  u: Pick<Universe, 'galaxies' | 'systems'>,
): ShownSystem | null {
  if (typeof raw !== 'string') return null;
  const m = /^(\d{1,4}):(\d{1,4})$/.exec(raw);
  if (!m) return null;
  const g = Number(m[1]);
  const s = Number(m[2]);
  return inRange(g, u.galaxies) && inRange(s, u.systems) ? { g, s } : null;
}

/** Whether the list of the state is the one of the system `at`. */
export const protectionOf = (
  list: ShownProtection | undefined,
  at: ShownSystem,
): readonly string[] | null =>
  list && list.g === at.g && list.s === at.s ? list.owners : null;
