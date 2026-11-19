// The Auspex-Phalanx (classic Sensorphalanx, #53, okf/features/moons.md):
// the rules the owner decided on 2026-11-13 and 2026-11-15, the classic
// simple rule. Its range is level² − 1 systems in its own galaxy; a scan
// costs 5,000 Promethium on the moon and shows every flight to and from the
// scanned foreign planet: ships, origin, target and arrival, no cargo. Moons
// cannot be scanned, a free position is refused without charge, and the
// scanned player is not told. The server and the Sternenkarte both ask
// `scanReach`; the server also `scanError` (patterns, section 7).
import { afford } from './economy.ts';
import { holdEnd } from './holding.ts';
import type {
  Coords,
  Cost,
  Fleet,
  Levels,
  Place,
  Planet,
  Resources,
} from './types.ts';

/** The price of one scan, paid on the moon of the phalanx. */
export const SCAN_COST: Readonly<Resources> = { m: 0, c: 0, d: 5000 };

/**
 * The range in systems at a level: level² − 1. Without a phalanx (level 0)
 * it is below 0, so nothing is in range.
 */
export const phalanxRange = (level: number): number => level * level - 1;

/**
 * The level of the Auspex-Phalanx on a place: its building on a moon, 0 on
 * a planet, where it cannot stand.
 */
export const phalanxLevel = (p: Pick<Planet, 'kind' | 'b'>): number =>
  p.kind === 'moon' ? (p.b.phalanx ?? 0) : 0;

/**
 * Whether `target` is in range of a phalanx at `level` on `at` (owner,
 * 2026-11-15): the same galaxy only, and |s − s₀| systems without a wrap
 * around the end of the galaxy, as `distance()` measures it.
 */
export const inPhalanxRange = (
  at: Coords,
  target: Coords,
  level: number,
): boolean =>
  at.g === target.g && Math.abs(at.s - target.s) <= phalanxRange(level);

/** Why a place cannot be scanned. */
export type ScanRefusal = 'moon' | 'notPlanet' | 'own';

/** Why a scan cannot start: from the place, the target, or the price. */
export type ScanError =
  'notMoon' | 'noPhalanx' | 'outOfRange' | 'free' | ScanRefusal | 'cost';

/** The place a scan starts from: the active place of the player. */
export type Scanner = Pick<Planet, 'kind' | 'owner' | 'b'> & Coords;

/**
 * The target of a scan: a place, and the owner of the planet there, or
 * undefined when no planet is there (a free position).
 */
export interface ScanTarget {
  place: Place;
  owner?: string;
}

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

/**
 * Why `scanner` cannot scan `target`, without the price, or null when it
 * can: the Sternenkarte offers the scan exactly then (owner, 2026-11-15).
 * Every refusal is free of charge.
 */
export function scanReach(
  scanner: Scanner,
  target: ScanTarget,
): ScanError | null {
  if (scanner.kind !== 'moon') return 'notMoon';
  const level = phalanxLevel(scanner);
  if (level < 1) return 'noPhalanx';
  if (target.place.kind !== 'planet')
    return scanRefusal(target.place.kind, null, scanner.owner);
  if (!inPhalanxRange(scanner, target.place, level)) return 'outOfRange';
  if (target.owner === undefined) return 'free';
  return scanRefusal('planet', target.owner, scanner.owner);
}

/** The price of a scan as a cost of Adamant, Psikristall and Promethium. */
export const SCAN_PRICE: Cost = [SCAN_COST.m, SCAN_COST.c, SCAN_COST.d];

/**
 * Why the scan cannot start, the price included: the moon must hold the
 * 5,000 Promethium. Null when it can, and the server then charges it.
 */
export const scanError = (
  scanner: Scanner & Pick<Planet, 'res'>,
  target: ScanTarget,
): ScanError | null =>
  scanReach(scanner, target) ?? (afford(scanner, SCAN_PRICE) ? null : 'cost');

/** One flight as a scan shows it: no cargo, owner, mission or fuel. */
export interface ScannedFlight {
  ships: Levels;
  /** The id of the place the flight comes from. */
  from: string;
  /** The id of the place the flight goes to. */
  to: string;
  /** When it arrives there; for a fleet that holds, when its holding ends. */
  arr: number;
  /** A fleet that holds at `to` (#55, owner, 2026-11-17), not one in flight. */
  holds?: true;
}

/**
 * The leg a fleet flies now: out from its start to its target, or back from
 * its target to its start, arriving at its return. A fleet that holds shows
 * as holding at its target until the end of its holding time (#55).
 */
function leg(f: Fleet): ScannedFlight {
  const ships = { ...f.ships };
  if (f.state === 'out') return { ships, from: f.from, to: f.to, arr: f.arr };
  if (f.state === 'hold')
    return { ships, from: f.from, to: f.to, arr: holdEnd(f), holds: true };
  return { ships, from: f.to, to: f.from, arr: f.ret };
}

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
