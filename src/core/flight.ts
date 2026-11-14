// Distance, speed, flight time, fuel and cargo of fleets. The flight values
// of a ship are its component `mobile`, read through the rule module
// components/mobile.ts (#114).
import { MOBILE, isShip } from './catalog.ts';
import * as M from './components/mobile.ts';
import type { Coords, Levels, ResearchState, Universe } from './types.ts';

/** Fleets a player can have in flight at once: 1 + Computertechnik. */
export const fleetSlots = (r: Pick<ResearchState, 'research'>): number =>
  1 + (r.research.computer ?? 0);

export function distance(a: Coords, b: Coords): number {
  if (a.g !== b.g) return 20000 * Math.abs(a.g - b.g);
  if (a.s !== b.s) return 2700 + 95 * Math.abs(a.s - b.s);
  if (a.p !== b.p) return 1000 + 5 * Math.abs(a.p - b.p);
  return 5;
}

/** The component `mobile` of a ship; undefined for anything that does not fly. */
const mobileOf = (key: string): M.Mobile | undefined =>
  Object.hasOwn(MOBILE, key) ? MOBILE[key] : undefined;

/**
 * The drive a ship flies with and its base speed: the base drive, or the last
 * drive switch whose research the player has reached (the Bomber, #57). A
 * ship without `mobile` has the drive of `STATIONARY`; null for anything that
 * is not a ship.
 */
export function activeDrive(
  key: string,
  r: Pick<ResearchState, 'research'>,
): M.ActiveDrive | null {
  if (!isShip(key)) return null;
  return M.activeDrive(mobileOf(key) ?? M.STATIONARY, r.research);
}

export function shipSpeed(
  key: string,
  r: Pick<ResearchState, 'research'>,
): number {
  const m = mobileOf(key);
  return m ? M.speed(m, r.research) : 0;
}

/** The slowest ship sets the speed. Infinity for an empty fleet. */
export function fleetSpeed(
  ships: Levels,
  r: Pick<ResearchState, 'research'>,
): number {
  let s = Infinity;
  for (const [k, n] of Object.entries(ships))
    if (n > 0) s = Math.min(s, shipSpeed(k, r));
  return s;
}

/** Duration of one way in ms; `pct` is the speed in tenths (1 to 10). */
export const flightMs = (
  dist: number,
  speed: number,
  pct: number,
  u: Universe,
): number =>
  Math.round(
    (((3500 / (pct / 10)) * Math.sqrt((dist * 10) / speed) + 10) / u.speed) *
      1000,
  );

export function fuelFor(ships: Levels, dist: number, pct: number): number {
  let f = 0;
  for (const [k, n] of Object.entries(ships)) {
    const m = mobileOf(k);
    if (m && n > 0)
      f += ((m.fuel * n * dist) / 35000) * Math.pow(pct / 10 + 1, 2);
  }
  return Math.round(f) + 1;
}

/** What a deploy unloads of the fuel it burnt: half, rounded down (#129). */
export const deployFuel = (fuel: number): number => Math.floor(fuel / 2);

export const capacity = (ships: Levels): number =>
  Object.entries(ships).reduce((a, [k, n]) => {
    const m = mobileOf(k);
    return a + (m ? m.cargo * n : 0);
  }, 0);

export const countUnits = (o: Levels | null | undefined): number =>
  Object.values(o ?? {}).reduce((a, b) => a + b, 0);
