// flight.ts from the component `mobile` (#114) gives what it gave before: a
// property test on generated fleets and research levels (owner, 2026-11-14).
// The reference below is the drive, speed, fuel and cargo part of flight.ts
// and canFly() of catalog.ts as they were on main before the flight
// component, copied unchanged; they read the table SHIPS, which
// catalog.test.ts holds equal to version 1.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import * as C from './catalog.ts';
import { DRIVE_BONUS, type DriveKey, SHIPS, isShip } from './catalog.ts';
import * as N from './flight.ts';
import type { Levels, ResearchState } from './types.ts';

// ---- reference: src/core/flight.ts and canFly() before the flight component ----

interface ActiveDrive {
  drive: DriveKey;
  speed: number;
}

function activeDrive(
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

function shipSpeed(key: string, r: Pick<ResearchState, 'research'>): number {
  const a = activeDrive(key, r);
  if (!a) return 0;
  return a.speed * (1 + DRIVE_BONUS[a.drive] * (r.research[a.drive] ?? 0));
}

function fleetSpeed(ships: Levels, r: Pick<ResearchState, 'research'>): number {
  let s = Infinity;
  for (const [k, n] of Object.entries(ships))
    if (n > 0) s = Math.min(s, shipSpeed(k, r));
  return s;
}

function fuelFor(ships: Levels, dist: number, pct: number): number {
  let f = 0;
  for (const [k, n] of Object.entries(ships)) {
    const ship = SHIPS[k];
    if (ship && n > 0)
      f += ((ship.fuel * n * dist) / 35000) * Math.pow(pct / 10 + 1, 2);
  }
  return Math.round(f) + 1;
}

const capacity = (ships: Levels): number =>
  Object.entries(ships).reduce(
    (a, [k, n]) => a + (SHIPS[k] ? SHIPS[k].cargo * n : 0),
    0,
  );

const canFly = (key: string): boolean => isShip(key) && SHIPS[key]!.speed > 0;

// ---- the property test ----

/** Every entry of the catalog and a key that is none. */
const KEYS = [
  ...Object.keys(C.BUILD),
  ...Object.keys(C.RES),
  ...Object.keys(C.UNIT),
  'nope',
];
/** Names every object inherits; they are no entries. */
const INHERITED = ['constructor', 'toString', '__proto__', 'hasOwnProperty'];

const research = fc.record({
  research: fc.dictionary(
    fc.constantFrom(...Object.keys(C.RES)),
    fc.integer({ min: 0, max: 30 }),
  ),
}) as fc.Arbitrary<Pick<ResearchState, 'research'>>;

const fleet = fc.dictionary(
  fc.constantFrom(...KEYS),
  fc.integer({ min: -2, max: 10000 }),
) as fc.Arbitrary<Levels>;

describe('flight from the component mobile equals flight before (#114)', () => {
  it('has the drive and the speed of before for every key', () => {
    fc.assert(
      fc.property(research, (r) => {
        for (const k of KEYS) {
          expect(N.activeDrive(k, r), k).toStrictEqual(activeDrive(k, r));
          expect(N.shipSpeed(k, r), k).toBe(shipSpeed(k, r));
        }
      }),
    );
  });

  it('lets fly exactly the ships of before', () => {
    for (const k of KEYS) expect(C.canFly(k), k).toBe(canFly(k));
    for (const k of INHERITED) expect(C.canFly(k), k).toBe(false);
  });

  it('gives the fleet speed, fuel and cargo of before', () => {
    fc.assert(
      fc.property(
        fleet,
        research,
        fc.integer({ min: 5, max: 200000 }),
        fc.integer({ min: 1, max: 10 }),
        (ships, r, dist, pct) => {
          expect(N.fleetSpeed(ships, r)).toBe(fleetSpeed(ships, r));
          expect(N.fuelFor(ships, dist, pct)).toBe(fuelFor(ships, dist, pct));
          expect(N.capacity(ships)).toBe(capacity(ships));
        },
      ),
      { numRuns: 500 },
    );
  });

  it('treats inherited names as no ship: no drive, no speed, no fuel, no cargo', () => {
    const r = { research: {} };
    for (const k of INHERITED) {
      expect(N.activeDrive(k, r), k).toBeNull();
      expect(N.shipSpeed(k, r), k).toBe(0);
      expect(N.fuelFor({ [k]: 3 }, 1000, 10), k).toBe(1);
      expect(N.capacity({ [k]: 3 }), k).toBe(0);
    }
  });
});
