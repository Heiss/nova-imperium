// The rules of the expeditions (#93, okf/features/expeditions.md): slots,
// holding time, the position, the caps of the rank-1 player, finds of
// resources, the attackers, the change of the return time and the draw of
// the event, with exact values and the edges of every threshold.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { seeded, U } from '../test/fixtures.ts';
import {
  EVENT_CHANCE,
  EVENT_KINDS,
  EVENT_SHARES,
  MIN_FLIGHT_MS,
  RAIDER_TECH_STEP,
  TIME_FACTOR,
  type EventKind,
  type EventShares,
  type Raider,
  type Size,
  between,
  capsOf,
  drawEvent,
  drawResource,
  drawSize,
  earlyReturn,
  evenBetween,
  expeditionPosition,
  expeditionSlots,
  holdMs,
  isExpeditionPlace,
  lateReturn,
  maxHoldHours,
  raidFleet,
  raiderTech,
  resourceFind,
  stayOf,
} from './expedition.ts';

/** A generator that gives the numbers in turn and then fails: every draw is accounted for. */
function queue(...values: number[]): () => number {
  const rest = [...values];
  return () => {
    if (!rest.length) throw new Error('more draws than expected');
    return rest.shift()!;
  };
}

const HOUR = 3_600_000;

/** A share over many draws is within a percent of what it should be. */
const near = (share: number, expected: number): void =>
  expect(Math.abs(share - expected)).toBeLessThan(0.01);

describe('slots and holding time (#93, Q3)', () => {
  it('allows as many expeditions at once as the floor of the square root of the level', () => {
    const slots = [0, 1, 2, 3, 4, 5, 8, 9, 15, 16, 24, 25, 99, 100].map(
      expeditionSlots,
    );
    expect(slots).toEqual([0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 4, 5, 9, 10]);
  });

  it('is the overview of the owiki: 1 slot up to level 3, 2 up to 8, 3 at level 9', () => {
    for (const [level, slots] of [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 2],
      [8, 2],
      [9, 3],
    ] as const)
      expect(expeditionSlots(level), `level ${level}`).toBe(slots);
  });

  it('holds as many hours as the level', () => {
    expect([0, 1, 2, 9].map(maxHoldHours)).toEqual([0, 1, 2, 9]);
    expect(holdMs(1)).toBe(3_600_000);
    expect(holdMs(3)).toBe(10_800_000);
    expect(holdMs(0)).toBe(0);
  });

  it('holds the same number of hours as the overview of the owiki for levels 1 to 9', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(maxHoldHours)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });
});

describe('the expedition position (#93, Q4)', () => {
  it('is the position after the last planet position: 16 with 15, 21 with 20', () => {
    expect(expeditionPosition({ positions: 15 })).toBe(16);
    expect(expeditionPosition({ positions: 20 })).toBe(21);
    expect(expeditionPosition({ positions: 12 })).toBe(13);
  });

  it('is a place of the universe only at that position of an existing system', () => {
    const u = { ...U, galaxies: 2, systems: 50, positions: 15 };
    expect(isExpeditionPlace({ g: 1, s: 1, p: 16 }, u)).toBe(true);
    expect(isExpeditionPlace({ g: 2, s: 50, p: 16 }, u)).toBe(true);
    expect(isExpeditionPlace({ g: 1, s: 1, p: 15 }, u)).toBe(false);
    expect(isExpeditionPlace({ g: 1, s: 1, p: 17 }, u)).toBe(false);
    expect(isExpeditionPlace({ g: 3, s: 1, p: 16 }, u)).toBe(false);
    expect(isExpeditionPlace({ g: 1, s: 51, p: 16 }, u)).toBe(false);
    expect(
      isExpeditionPlace({ g: 1, s: 1, p: 21 }, { ...u, positions: 20 }),
    ).toBe(true);
    expect(
      isExpeditionPlace({ g: 1, s: 1, p: 16 }, { ...u, positions: 20 }),
    ).toBe(false);
  });

  it('knows the stay of a fleet from its times: what lies between the flight out and the flight home', () => {
    // dep 100, flight 1,000, stay 2 hours: arr = dep + flight + stay.
    const arr = 100 + 1000 + 2 * HOUR;
    expect(stayOf({ dep: 100, arr, ret: arr + 1000 })).toBe(2 * HOUR);
    expect(stayOf({ dep: 0, arr: 5000, ret: 7000 })).toBe(3000);
    // No stay: the fleet is at its target when the flight out ends.
    expect(stayOf({ dep: 0, arr: 1000, ret: 2000 })).toBe(0);
  });
});

describe('the size of an event (owiki: 89, 10 and 1 %)', () => {
  it('is normal below 0.89, large below 0.99, very large from there', () => {
    expect(
      [0, 0.5, 0.8899, 0.89, 0.9, 0.9899, 0.99, 0.995, 0.9999].map((r) =>
        drawSize(() => r),
      ),
    ).toEqual([
      'normal',
      'normal',
      'normal',
      'large',
      'large',
      'large',
      'huge',
      'huge',
      'huge',
    ]);
  });

  it('draws numbers from lo to hi, also the even ones, both ends reachable', () => {
    const top = 0.9999999999;
    expect(between(() => 0, 10, 50)).toBe(10);
    expect(between(() => top, 10, 50)).toBe(50);
    expect(between(() => 0.5, 10, 50)).toBe(30);
    expect(evenBetween(() => 0, 10, 50)).toBe(10);
    expect(evenBetween(() => top, 10, 50)).toBe(50);
    expect(evenBetween(() => 0.5, 10, 50)).toBe(30);
    expect(evenBetween(() => 0.5, 52, 100)).toBe(76);
    for (let i = 0; i < 100; i++) {
      const rng = seeded(i);
      expect(evenBetween(rng, 102, 200) % 2).toBe(0);
    }
  });

  it('has the shares of the owiki over many draws', () => {
    const rng = seeded(93);
    const n = 100_000;
    const seen: Record<Size, number> = { normal: 0, large: 0, huge: 0 };
    for (let i = 0; i < n; i++) seen[drawSize(rng)]++;
    near(seen.normal / n, 0.89);
    near(seen.large / n, 0.1);
    near(seen.huge / n, 0.01);
  });
});

describe('the caps of the rank-1 player (owner, 2026-11-17)', () => {
  it('steps at 100,000, 1,000,000 and 5,000,000 points', () => {
    expect(capsOf(0)).toEqual({ resources: 2400, ships: 1250 });
    expect(capsOf(99_999)).toEqual({ resources: 2400, ships: 1250 });
    expect(capsOf(100_000)).toEqual({ resources: 6000, ships: 3000 });
    expect(capsOf(1_000_000)).toEqual({ resources: 6000, ships: 3000 });
    expect(capsOf(1_000_001)).toEqual({ resources: 9000, ships: 4500 });
    expect(capsOf(5_000_000)).toEqual({ resources: 9000, ships: 4500 });
    expect(capsOf(5_000_001)).toEqual({ resources: 12000, ships: 6000 });
    expect(capsOf(1e9)).toEqual({ resources: 12000, ships: 6000 });
  });
});

describe('the resource of a find (owner, 2026-11-16: 3 : 2 : 1)', () => {
  it('is Adamant below a half, Psikristall below five sixths, else Promethium', () => {
    expect(
      [0, 0.49, 0.5, 0.51, 0.83, 0.84, 0.99].map((r) => drawResource(() => r)),
    ).toEqual(['m', 'm', 'c', 'c', 'c', 'd', 'd']);
  });

  it('has the ratio 3 : 2 : 1 over many draws', () => {
    const rng = seeded(7);
    const n = 60_000;
    const seen = { m: 0, c: 0, d: 0 };
    for (let i = 0; i < n; i++) seen[drawResource(rng)]++;
    near(seen.m / n, 1 / 2);
    near(seen.c / n, 1 / 3);
    near(seen.d / n, 1 / 6);
  });
});

describe('a find of resources (owiki „Rohstofffund“)', () => {
  const room = 1e12;

  it('is the base number times the expedition points, at least 200', () => {
    // base: even number 10 to 50: 0.5 gives 30; resource 0.1: Adamant.
    expect(resourceFind(queue(0.5, 0.1), 'normal', 100, 0, room)).toEqual({
      res: 'm',
      amount: 6000,
    });
    expect(resourceFind(queue(0.5, 0.1), 'normal', 199, 0, room).amount).toBe(
      6000,
    );
    expect(resourceFind(queue(0.5, 0.1), 'normal', 200, 0, room).amount).toBe(
      6000,
    );
    expect(resourceFind(queue(0.5, 0.1), 'normal', 201, 0, room).amount).toBe(
      6030,
    );
    expect(resourceFind(queue(0.5, 0.1), 'normal', 1000, 0, room).amount).toBe(
      30000,
    );
  });

  it('halves the base number for Psikristall and takes a third for Promethium', () => {
    expect(resourceFind(queue(0.5, 0.6), 'normal', 200, 0, room)).toEqual({
      res: 'c',
      amount: 3000,
    });
    expect(resourceFind(queue(0.5, 0.9), 'normal', 200, 0, room)).toEqual({
      res: 'd',
      amount: 2000,
    });
    // A third is rounded down: 10 / 3 · 200 = 666.
    expect(resourceFind(queue(0, 0.9), 'normal', 200, 0, room).amount).toBe(
      666,
    );
  });

  it('takes the base number from 10 to 50, 50 to 100 or 100 to 200 by its size', () => {
    const top = 0.9999999999;
    const find = (size: Size, a: number) =>
      resourceFind(queue(a, 0.1), size, 200, 0, room).amount;
    expect(find('normal', 0)).toBe(10 * 200);
    expect(find('normal', top)).toBe(50 * 200);
    expect(find('large', 0)).toBe(50 * 200);
    expect(find('large', top)).toBe(100 * 200);
    expect(find('large', 0.5)).toBe(76 * 200);
    expect(find('huge', 0)).toBe(100 * 200);
    expect(find('huge', top)).toBe(200 * 200);
    expect(find('huge', 0.5)).toBe(150 * 200);
  });

  it('caps the expedition points by the points of rank 1', () => {
    const at = (points: number, rank1: number) =>
      resourceFind(queue(0.5, 0.1), 'normal', points, rank1, room).amount;
    // 30 · the points, at most the cap of the tier.
    expect(at(2400, 0)).toBe(72_000);
    expect(at(2401, 0)).toBe(72_000);
    expect(at(99_999, 99_999)).toBe(72_000);
    expect(at(6000, 100_000)).toBe(180_000);
    expect(at(6001, 100_000)).toBe(180_000);
    expect(at(9000, 1_000_001)).toBe(270_000);
    expect(at(9001, 1_000_001)).toBe(270_000);
    expect(at(12000, 5_000_001)).toBe(360_000);
    expect(at(12001, 5_000_001)).toBe(360_000);
    expect(at(1e9, 5_000_001)).toBe(360_000);
  });

  it('takes at most what the holds carry, never less than nothing', () => {
    const at = (room: number) =>
      resourceFind(queue(0.5, 0.1), 'normal', 100, 0, room).amount;
    expect(at(6000)).toBe(6000);
    expect(at(5999.9)).toBe(5999);
    expect(at(1000.7)).toBe(1000);
    expect(at(0)).toBe(0);
    expect(at(-5)).toBe(0);
  });

  it('draws the base number first and the resource second, nothing else', () => {
    const asked: number[] = [];
    resourceFind(
      () => {
        asked.push(asked.length);
        return 0;
      },
      'large',
      200,
      0,
      room,
    );
    expect(asked).toEqual([0, 1]);
  });
});

/** The shares every event has once. */
const EVEN: EventShares = {
  resources: 1,
  ships: 1,
  pirates: 1,
  aliens: 1,
  lost: 1,
  early: 1,
  late: 1,
};

describe('the attackers (owiki „Kämpfe gegen andere Flotten“)', () => {
  const fleet = { lc: 10, sc: 5 };

  it('takes for pirates a share of every ship type rounded down, then adds the extra ships', () => {
    // 30 % ± 10 % of the mean: the draw 0 gives 0.27, 0.5 gives 0.30, 1 gives 0.33.
    expect(raidFleet(queue(0, 0), 'pirates', 'normal', fleet)).toEqual({
      lc: 2,
      sc: 1,
      lf: 5,
    });
    expect(raidFleet(queue(0.5, 0.5), 'pirates', 'normal', fleet)).toEqual({
      lc: 3,
      sc: 1,
      lf: 5,
    });
    expect(
      raidFleet(queue(0.9999999, 0.9999999), 'pirates', 'normal', fleet),
    ).toEqual({ lc: 3, sc: 1, lf: 5 });
  });

  it('takes for aliens a share rounded up, with their own extra ships', () => {
    expect(raidFleet(queue(0, 0), 'aliens', 'normal', fleet)).toEqual({
      lc: 4,
      sc: 2,
      hf: 5,
    });
    // 40 % of 10 is exactly 4: no step up.
    expect(raidFleet(queue(0.5, 0.5), 'aliens', 'normal', fleet)).toEqual({
      lc: 4,
      sc: 2,
      hf: 5,
    });
    expect(
      raidFleet(queue(0.9999999, 0.9999999), 'aliens', 'normal', fleet),
    ).toEqual({ lc: 5, sc: 3, hf: 5 });
  });

  it('has the shares and the extra ships of each size', () => {
    const own = { lf: 100 };
    const mid = (raider: Raider, size: Size) =>
      raidFleet(queue(0.5), raider, size, own);
    expect(mid('pirates', 'normal')).toEqual({ lf: 30 + 5 });
    expect(mid('pirates', 'large')).toEqual({ lf: 50, cr: 3 });
    expect(mid('pirates', 'huge')).toEqual({ lf: 80, bs: 2 });
    expect(mid('aliens', 'normal')).toEqual({ lf: 40, hf: 5 });
    expect(mid('aliens', 'large')).toEqual({ lf: 60, bc: 3 });
    expect(mid('aliens', 'huge')).toEqual({ lf: 90, dr: 2 });
  });

  it('adds the extra ships to a type the fleet has itself', () => {
    expect(raidFleet(queue(0.5), 'pirates', 'large', { cr: 2 })).toEqual({
      cr: 1 + 3,
    });
  });

  it('leaves out a type that comes to none and a type the fleet does not have', () => {
    // 0.27 · 3 = 0.81 rounds down to none.
    expect(
      raidFleet(queue(0, 0), 'pirates', 'normal', { probe: 3, sc: 0 }),
    ).toEqual({
      lf: 5,
    });
    expect(raidFleet(queue(), 'pirates', 'normal', { probe: 0 })).toEqual({
      lf: 5,
    });
    expect(raidFleet(queue(0), 'pirates', 'normal', {})).toEqual({ lf: 5 });
  });

  it('draws once per ship type and does not change the fleet', () => {
    const own = { lc: 10, sc: 5, probe: 2 };
    const asked: number[] = [];
    raidFleet(
      () => {
        asked.push(0);
        return 0.5;
      },
      'aliens',
      'huge',
      own,
    );
    expect(asked).toHaveLength(3);
    expect(own).toEqual({ lc: 10, sc: 5, probe: 2 });
  });

  it('levels pirates three below and aliens three above, never below 0', () => {
    expect(RAIDER_TECH_STEP).toBe(3);
    const own = { weapons: 5, shield: 2, armor: 0, laser: 9 };
    expect(raiderTech('pirates', own)).toEqual({
      weapons: 2,
      shield: 0,
      armor: 0,
    });
    expect(raiderTech('aliens', own)).toEqual({
      weapons: 8,
      shield: 5,
      armor: 3,
    });
    expect(raiderTech('pirates', {})).toEqual({
      weapons: 0,
      shield: 0,
      armor: 0,
    });
    expect(raiderTech('aliens', {})).toEqual({
      weapons: 3,
      shield: 3,
      armor: 3,
    });
    expect(raiderTech('pirates', { weapons: 3, shield: 4 })).toEqual({
      weapons: 0,
      shield: 1,
      armor: 0,
    });
  });

  it('never gives more than the share of the fleet plus the extra ships (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e6 }),
        fc.integer({ min: 0, max: 5000 }),
        fc.constantFrom<Raider>('pirates', 'aliens'),
        fc.constantFrom<Size>('normal', 'large', 'huge'),
        (seed, n, raider, size) => {
          const out = raidFleet(seeded(seed), raider, size, { lc: n });
          const share = { normal: 0.4, large: 0.6, huge: 0.9 }[size];
          expect(out.lc ?? 0).toBeLessThanOrEqual(Math.ceil(n * share * 1.1));
          for (const count of Object.values(out))
            expect(count).toBeGreaterThan(0);
        },
      ),
    );
  });
});

describe('a change of the return time (owner, 2026-11-17)', () => {
  it('multiplies the stay by 2, 3 or 5', () => {
    expect(TIME_FACTOR).toEqual({ normal: 2, large: 3, huge: 5 });
    expect(MIN_FLIGHT_MS).toBe(1000);
  });

  it('adds the stay times the factor to the flight home when late', () => {
    expect(lateReturn(1000, 500, HOUR, 'normal')).toBe(1000 + 500 + 2 * HOUR);
    expect(lateReturn(1000, 500, HOUR, 'large')).toBe(1000 + 500 + 3 * HOUR);
    expect(lateReturn(1000, 500, HOUR, 'huge')).toBe(1000 + 500 + 5 * HOUR);
    expect(lateReturn(1000, 500, 3 * HOUR, 'normal')).toBe(
      1000 + 500 + 6 * HOUR,
    );
    expect(lateReturn(1000, 500, 0, 'huge')).toBe(1500);
  });

  it('takes a third of the stay times the factor off the flight home when early', () => {
    const flight = 10 * HOUR;
    expect(earlyReturn(1000, flight, 3 * HOUR, 'normal')).toBe(
      1000 + 10 * HOUR - 2 * HOUR,
    );
    expect(earlyReturn(1000, flight, 3 * HOUR, 'large')).toBe(
      1000 + 10 * HOUR - 3 * HOUR,
    );
    expect(earlyReturn(1000, flight, 3 * HOUR, 'huge')).toBe(
      1000 + 10 * HOUR - 5 * HOUR,
    );
    expect(earlyReturn(1000, 5000, 0, 'huge')).toBe(6000);
  });

  it('rounds to a millisecond and stays above a second of flight home', () => {
    // 1000 / 3 · 2 = 666.67 off 5000 leaves 4333.33.
    expect(earlyReturn(0, 5000, 1000, 'normal')).toBe(4333);
    // 3000 / 3 · 2 = 2000 off the flight: 999 and 1001 around the second.
    expect(earlyReturn(0, 2999, 3000, 'normal')).toBe(1000);
    expect(earlyReturn(0, 3000, 3000, 'normal')).toBe(1000);
    expect(earlyReturn(0, 3001, 3000, 'normal')).toBe(1001);
    expect(earlyReturn(500, 100, 3000, 'huge')).toBe(1500);
  });
});

describe('the event of an expedition (owner, 2026-11-16 and 2026-11-17)', () => {
  it('has about 84 % events and the seven kinds in a fixed order', () => {
    expect(EVENT_CHANCE).toBe(0.84);
    expect(EVENT_KINDS).toEqual([
      'resources',
      'ships',
      'pirates',
      'aliens',
      'lost',
      'early',
      'late',
    ]);
  });

  it('is not decided yet: without shares nothing happens and nothing is drawn', () => {
    expect(EVENT_SHARES).toBeNull();
    expect(drawEvent(queue())).toEqual({ kind: 'nothing' });
    expect(drawEvent(queue(), null)).toEqual({ kind: 'nothing' });
  });

  it('brings an event below 0.84 and none from 0.84 on', () => {
    expect(drawEvent(queue(0.84), EVEN)).toEqual({ kind: 'nothing' });
    expect(drawEvent(queue(0.99), EVEN)).toEqual({ kind: 'nothing' });
    expect(drawEvent(queue(0.8399999, 0.1, 0.5), EVEN)).toEqual({
      kind: 'resources',
      size: 'normal',
    });
    expect(drawEvent(queue(0, 0, 0), EVEN)).toEqual({
      kind: 'resources',
      size: 'normal',
    });
  });

  it('takes the kind by the shares, in the order of the kinds', () => {
    const kind = (e: EventKind) =>
      drawEvent(queue(0.5, (EVENT_KINDS.indexOf(e) + 0.5) / 7, 0.5), EVEN);
    expect(kind('resources')).toEqual({ kind: 'resources', size: 'normal' });
    expect(kind('ships')).toEqual({ kind: 'ships', size: 'normal' });
    expect(kind('pirates')).toEqual({ kind: 'pirates', size: 'normal' });
    expect(kind('aliens')).toEqual({ kind: 'aliens', size: 'normal' });
    expect(kind('early')).toEqual({ kind: 'early', size: 'normal' });
    expect(kind('late')).toEqual({ kind: 'late', size: 'normal' });
  });

  it('weighs the kinds by their shares and skips a share of 0', () => {
    const only = (e: EventKind, weight = 3): EventShares => ({
      resources: 0,
      ships: 0,
      pirates: 0,
      aliens: 0,
      lost: 0,
      early: 0,
      late: 0,
      [e]: weight,
    });
    for (const e of EVENT_KINDS.filter((k) => k !== 'lost'))
      for (const r of [0, 0.5, 0.9999]) {
        expect(drawEvent(queue(0, r, 0), only(e)), `${e} ${r}`).toEqual({
          kind: e,
          size: 'normal',
        });
      }
    const mixed: EventShares = { ...only('ships', 1), pirates: 3 };
    // 1 : 3 — below a quarter ships, above pirates.
    expect(drawEvent(queue(0, 0.24, 0), mixed)).toMatchObject({
      kind: 'ships',
    });
    expect(drawEvent(queue(0, 0.26, 0), mixed)).toMatchObject({
      kind: 'pirates',
    });
  });

  it('gives the loss of the fleet no size and draws nothing more for it', () => {
    const only: EventShares = {
      resources: 0,
      ships: 0,
      pirates: 0,
      aliens: 0,
      lost: 1,
      early: 0,
      late: 0,
    };
    expect(drawEvent(queue(0, 0.5), only)).toEqual({ kind: 'lost' });
  });

  it('draws the size of the other events as 89, 10 and 1 %', () => {
    const sized = (r: number) => drawEvent(queue(0, 0.1, r), EVEN);
    expect(sized(0.5)).toEqual({ kind: 'resources', size: 'normal' });
    expect(sized(0.95)).toEqual({ kind: 'resources', size: 'large' });
    expect(sized(0.995)).toEqual({ kind: 'resources', size: 'huge' });
  });

  it('follows the shares over many draws, with 16 % nothing (property)', () => {
    const rng = seeded(11);
    const shares: EventShares = { ...EVEN, resources: 4, lost: 0.5 };
    const n = 60_000;
    const seen: Record<string, number> = {};
    for (let i = 0; i < n; i++) {
      const e = drawEvent(rng, shares);
      seen[e.kind] = (seen[e.kind] ?? 0) + 1;
    }
    near(seen.nothing! / n, 0.16);
    const total = 4 + 5 + 0.5;
    near(seen.resources! / n, (0.84 * 4) / total);
    near(seen.lost! / n, (0.84 * 0.5) / total);
    near(seen.pirates! / n, (0.84 * 1) / total);
  });
});
