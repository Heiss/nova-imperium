// Distance, speed, flight time, fuel and cargo of fleets.
import { DRIVE_BONUS, type DriveKey, SHIPS, isShip } from './catalog.ts';
import type { Coords, Levels, ResearchState, Universe } from './types.ts';

export const pid = (c: Coords): string => `p${c.g}_${c.s}_${c.p}`;

/** Fleets a player can have in flight at once: 1 + Computertechnik. */
export const fleetSlots = (r: Pick<ResearchState, 'research'>): number =>
  1 + (r.research.computer ?? 0);

export function distance(a: Coords, b: Coords): number {
  if (a.g !== b.g) return 20000 * Math.abs(a.g - b.g);
  if (a.s !== b.s) return 2700 + 95 * Math.abs(a.s - b.s);
  if (a.p !== b.p) return 1000 + 5 * Math.abs(a.p - b.p);
  return 5;
}

export interface ActiveDrive {
  drive: DriveKey;
  speed: number;
}

/**
 * The drive a ship flies with and its base speed: the base drive, or the last
 * drive switch whose research the player has reached (the Bomber, #57). Null
 * for anything that is not a ship.
 */
export function activeDrive(
  key: string,
  r: Pick<ResearchState, 'research'>,
): ActiveDrive | null {
  if (!isShip(key)) return null;
  const ship = SHIPS[key]!;
  let active: ActiveDrive = { drive: ship.drive, speed: ship.speed };
  for (const d of ship.drives ?? [])
    if ((r.research[d.from.research] ?? 0) >= d.from.level)
      active = { drive: d.drive, speed: d.speed };
  return active;
}

export function shipSpeed(
  key: string,
  r: Pick<ResearchState, 'research'>,
): number {
  const a = activeDrive(key, r);
  if (!a) return 0;
  return a.speed * (1 + DRIVE_BONUS[a.drive] * (r.research[a.drive] ?? 0));
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
    const ship = SHIPS[k];
    if (ship && n > 0)
      f += ((ship.fuel * n * dist) / 35000) * Math.pow(pct / 10 + 1, 2);
  }
  return Math.round(f) + 1;
}

/** What a deploy unloads of the fuel it burnt: half, rounded down (#129). */
export const deployFuel = (fuel: number): number => Math.floor(fuel / 2);

export const capacity = (ships: Levels): number =>
  Object.entries(ships).reduce(
    (a, [k, n]) => a + (SHIPS[k] ? SHIPS[k].cargo * n : 0),
    0,
  );

export const countUnits = (o: Levels | null | undefined): number =>
  Object.values(o ?? {}).reduce((a, b) => a + b, 0);
