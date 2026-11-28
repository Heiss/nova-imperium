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

/**
 * The owners of the shown system that the noob protection covers against the
 * player, and the places of them where it lapses for an attack and an
 * espionage because a fleet of another player holds there (#440, 238c, 281b);
 * the key only while there is one.
 */
export interface ShownProtection extends ShownSystem {
  owners: string[];
  lapsed?: string[];
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

/**
 * Whether the Sternenkarte marks the place `pl` as protected (n): its owner is
 * covered, and the protection has not lapsed at the place (#440). False until
 * the list of its system is there.
 */
export const shownProtected = (
  list: ShownProtection | undefined,
  pl: ShownSystem & { id: string; owner: string },
): boolean =>
  (protectionOf(list, pl)?.includes(pl.owner) ?? false) &&
  !list!.lapsed?.includes(pl.id);
