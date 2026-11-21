// The components `silo` and `missile` (okf/architecture/patterns.md,
// sections 1 and 12; #54, okf/features/missiles.md): a building with `silo`
// stores missiles, `slots` places per level; a defense with `missile` is a
// missile and takes `slots` places of them. The Raketenkrypta has 10 places
// per level, an Abfangrakete takes 1, an Orbitalrakete 2 (owner,
// 2026-11-16, Q1: 10 anti-ballistic or 5 interplanetary missiles per
// level). A missile that `intercepts` stops one incoming missile; the
// others are launched at a foreign planet. Only this module reads the two
// components; yard.ts asks it for the room a place has left, the missile
// rules for which missiles intercept and which strike.
import type { Levels } from '../types.ts';

/** A building that stores missiles. */
export interface Silo {
  /** The places every level gives. */
  slots: number;
}

/** A missile: a defense that waits in a silo and does not fight. */
export interface Missile {
  /** The places one missile takes in the silo. */
  slots: number;
  /**
   * It stops one incoming missile before the impact (the Abfangrakete);
   * without it, the missile is launched at a foreign planet.
   */
  intercepts?: true;
}

/** The places the silos of a place give: every level times its `slots`. */
export function siloPlaces(
  silos: Readonly<Record<string, Silo>>,
  b: Levels,
): number {
  let n = 0;
  for (const [key, s] of Object.entries(silos)) n += (b[key] ?? 0) * s.slots;
  return n;
}

/**
 * The places the missiles of a place take: each missile it has or has
 * ordered times its `slots`.
 */
export function missilePlaces(
  missiles: Readonly<Record<string, Missile>>,
  pieces: Levels,
): number {
  let n = 0;
  for (const [key, m] of Object.entries(missiles))
    n += (pieces[key] ?? 0) * m.slots;
  return n;
}

/**
 * How many more pieces of a missile fit into `free` places, never below 0;
 * Infinity for anything that is no missile.
 */
export const fits = (missile: Missile | undefined, free: number): number =>
  missile ? Math.max(0, Math.floor(free / missile.slots)) : Infinity;

/** Whether a missile is launched rather than stopping incoming ones. */
export const strikes = (missile: Missile): boolean => !missile.intercepts;
