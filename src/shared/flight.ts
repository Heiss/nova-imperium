// Distance, speed, flight time, fuel and cargo of fleets.
import { DRIVE_BONUS, SHIPS } from './catalog.ts';
import type { Coords, Levels, ResearchState, Universe } from './types.ts';

export const pid = (c: Coords): string => `p${c.g}_${c.s}_${c.p}`;

export function distance(a: Coords, b: Coords): number {
  if (a.g !== b.g) return 20000 * Math.abs(a.g - b.g);
  if (a.s !== b.s) return 2700 + 95 * Math.abs(a.s - b.s);
  if (a.p !== b.p) return 1000 + 5 * Math.abs(a.p - b.p);
  return 5;
}

export function shipSpeed(
  key: string,
  r: Pick<ResearchState, 'research'>,
): number {
  const ship = SHIPS[key];
  if (!ship) return 0;
  return (
    ship.speed * (1 + DRIVE_BONUS[ship.drive] * (r.research[ship.drive] ?? 0))
  );
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

export const capacity = (ships: Levels): number =>
  Object.entries(ships).reduce(
    (a, [k, n]) => a + (SHIPS[k] ? SHIPS[k].cargo * n : 0),
    0,
  );

export const countUnits = (o: Levels | null | undefined): number =>
  Object.values(o ?? {}).reduce((a, b) => a + b, 0);
