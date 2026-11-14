// The Auspex-Phalanx (classic Sensorphalanx, #53, okf/features/moons.md):
// the rules the owner decided on 2026-11-13, the classic simple rule. Its
// range is level² − 1 systems; a scan costs 5,000 Promethium on the moon and
// shows every flight to and from the scanned foreign planet: ships, origin,
// target and arrival, no cargo. Moons cannot be scanned, and the scanned
// player is not told.
import type { Fleet, Levels, Place, Resources } from './types.ts';

/** The price of one scan, paid on the moon of the phalanx. */
export const SCAN_COST: Readonly<Resources> = { m: 0, c: 0, d: 5000 };

/**
 * The range in systems at a level: level² − 1. Without a phalanx (level 0)
 * it is below 0, so nothing is in range.
 */
export const phalanxRange = (level: number): number => level * level - 1;

/** Why a place cannot be scanned. */
export type ScanRefusal = 'moon' | 'notPlanet' | 'own';

/**
 * Why a place of the kind with the owner cannot be scanned by `scanner`, or
 * null when it can: only a foreign planet; never a moon (owner, 2026-11-13).
 */
export function scanRefusal(
  kind: Place['kind'],
  owner: string | null,
  scanner: string,
): ScanRefusal | null {
  if (kind === 'moon') return 'moon';
  if (kind !== 'planet') return 'notPlanet';
  return owner === scanner ? 'own' : null;
}

/** One flight as a scan shows it: no cargo, owner, mission or fuel. */
export interface ScannedFlight {
  ships: Levels;
  /** The id of the place the flight comes from. */
  from: string;
  /** The id of the place the flight goes to. */
  to: string;
  /** When it arrives there. */
  arr: number;
}

/**
 * The leg a fleet flies now: out from its start to its target, or back from
 * its target to its start, arriving at its return.
 */
const leg = (f: Fleet): ScannedFlight =>
  f.state === 'out'
    ? { ships: { ...f.ships }, from: f.from, to: f.to, arr: f.arr }
    : { ships: { ...f.ships }, from: f.to, to: f.from, arr: f.ret };

/**
 * Every flight to and from the planet `id`, by arrival: the fleets of every
 * player that start or end there. Flights of its moon are not the planet's.
 */
export const scanFlights = (
  fleets: readonly Fleet[],
  id: string,
): ScannedFlight[] =>
  fleets
    .filter((f) => f.from === id || f.to === id)
    .map(leg)
    .sort((a, b) => a.arr - b.arr);
