// The speed of a fleet that joins an attack union (#466, 7b): it starts now
// and arrives exactly at the union's arrival X, between 10 % and 100 %, or
// the send is refused, too early with the earliest start, too late.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { flightMs } from './flight.ts';
import type { Universe } from './types.ts';
import { FASTEST, SLOWEST, unionFlight } from './union.ts';

const world = (speed: number) => ({ speed }) as Universe;

/** The flight time at a speed in tenths, before the rounding of `flightMs`. */
const exactMs = (dist: number, speed: number, pct: number, u: Universe) =>
  (((35000 / pct) * Math.sqrt((dist * 10) / speed) + 10) / u.speed) * 1000;

describe('the speed of a fleet that joins a union (#466)', () => {
  it('arrives at X within the speeds, or is refused by the bounds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 100_000 }),
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.integer({ min: 1, max: 400_000_000 }),
        (dist, speed, s, now, left) => {
          const u = world(s);
          const arr = now + left;
          const out = unionFlight({ dist, speed, universe: u, now, arr });
          const slowest = flightMs(dist, speed, SLOWEST, u);
          const fastest = flightMs(dist, speed, FASTEST, u);
          if ('pct' in out) {
            expect(out.pct).toBeGreaterThanOrEqual(SLOWEST);
            expect(out.pct).toBeLessThanOrEqual(FASTEST);
            expect(left).toBeLessThanOrEqual(slowest);
            expect(left).toBeGreaterThanOrEqual(fastest);
            // The flight at that speed takes the time left, to the rounding
            // of `flightMs` (half a millisecond at a bound).
            expect(
              Math.abs(exactMs(dist, speed, out.pct, u) - left),
            ).toBeLessThan(0.5 + 1e-6);
          } else if (out.error === 'early') {
            expect(left).toBeGreaterThan(slowest);
            expect(out.earliest).toBe(arr - slowest);
          } else expect(left).toBeLessThan(fastest);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it('takes the boundaries inside: exactly the time at 10 % and at 100 %', () => {
    const u = world(5);
    const slow = flightMs(2700, 12500, SLOWEST, u);
    const fast = flightMs(2700, 12500, FASTEST, u);
    expect(
      unionFlight({ dist: 2700, speed: 12500, universe: u, now: 0, arr: slow }),
    ).toEqual({ pct: expect.closeTo(SLOWEST, 6) });
    expect(
      unionFlight({ dist: 2700, speed: 12500, universe: u, now: 0, arr: fast }),
    ).toEqual({ pct: expect.closeTo(FASTEST, 3) });
    expect(
      unionFlight({
        dist: 2700,
        speed: 12500,
        universe: u,
        now: 0,
        arr: slow + 1,
      }),
    ).toEqual({ error: 'early', earliest: 1 });
    expect(
      unionFlight({
        dist: 2700,
        speed: 12500,
        universe: u,
        now: 0,
        arr: fast - 1,
      }),
    ).toEqual({ error: 'late' });
  });

  it('picks a speed between the steps: half way in time is no step of 10 %', () => {
    const u = world(1);
    const slow = flightMs(1000, 10000, SLOWEST, u);
    const fast = flightMs(1000, 10000, FASTEST, u);
    const out = unionFlight({
      dist: 1000,
      speed: 10000,
      universe: u,
      now: 1000,
      arr: 1000 + Math.round((slow + fast) / 2),
    });
    expect('pct' in out && out.pct).toBeCloseTo(1.818, 2);
  });
});
