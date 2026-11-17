// The rules of giving up a colony (#224, owner, 2026-11-16): the lock of the
// position (D2) and its boundaries, the main planet (D3) and every running
// reference to the planet or its moon (D1).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ABANDON_LOCK_HOURS,
  type AbandonCheck,
  HOUR_MS,
  abandonError,
  abandonTargetError,
  isAbandonLockHours,
  positionLockEnd,
  positionLocked,
} from './abandon.ts';
import type { Queue } from './types.ts';

const NOW = 1_763_300_000_000;
const colony = {
  id: 'p2_5_9',
  owner: 'u_Anna',
  kind: 'planet' as const,
  bq: null,
  sq: [],
};
const moon = { id: 'm2_5_9', bq: null, sq: [] };
const queue: Queue = {
  key: 'metal',
  lvl: 2,
  start: 0,
  end: 10,
  cost: [1, 2, 3],
};

const check = (over: Partial<AbandonCheck>): AbandonCheck => ({
  target: colony,
  moon: null,
  uid: 'u_Anna',
  main: 'p1_2_3',
  flights: [],
  research: null,
  ...over,
});

describe('the lock length of a round', () => {
  it('is 24 hours by default, whole hours from 1 to 720', () => {
    expect(ABANDON_LOCK_HOURS).toEqual({ min: 1, max: 720, default: 24 });
    expect(HOUR_MS).toBe(60 * 60 * 1000);
    for (const hours of [1, 24, 720])
      expect(isAbandonLockHours(hours)).toBe(true);
    for (const hours of [0, 721, -1, 1.5, '24', null, undefined, Number.NaN])
      expect(isAbandonLockHours(hours)).toBe(false);
  });
});

describe('the lock of a given-up position', () => {
  it('ends the hours of the round after the abandonment', () => {
    expect(positionLockEnd(NOW, 24)).toBe(NOW + 24 * HOUR_MS);
    expect(positionLockEnd(NOW, 1)).toBe(NOW + HOUR_MS);
  });

  it('holds until its end, not at it, and never without one', () => {
    const end = positionLockEnd(NOW, 24);
    expect(positionLocked(end, NOW)).toBe(true);
    expect(positionLocked(end, end - 1)).toBe(true);
    expect(positionLocked(end, end)).toBe(false);
    expect(positionLocked(end, end + 1)).toBe(false);
    expect(positionLocked(null, NOW)).toBe(false);
  });

  it('holds exactly before its end, for every length (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 ** 42 }),
        fc.integer({ min: 1, max: 720 }),
        fc.integer({ min: 0, max: 720 * HOUR_MS * 2 }),
        (at, hours, later) =>
          positionLocked(positionLockEnd(at, hours), at + later) ===
          later < hours * HOUR_MS,
      ),
    );
  });
});

describe('which planet can be given up', () => {
  it('is an own colony without references', () => {
    expect(abandonError(check({}))).toBeNull();
    expect(abandonError(check({ moon }))).toBeNull();
  });

  it('is never a missing or foreign planet', () => {
    expect(abandonError(check({ target: null }))).toBe('unknown');
    expect(
      abandonError(check({ target: { ...colony, owner: 'u_Bert' } })),
    ).toBe('unknown');
  });

  it('is never a moon alone (out of scope)', () => {
    expect(
      abandonError(
        check({ target: { ...colony, id: 'm2_5_9', kind: 'moon' } }),
      ),
    ).toBe('moon');
  });

  it('is never the main planet: the player changes it first (D3)', () => {
    expect(abandonError(check({ main: colony.id }))).toBe('main');
    expect(abandonError(check({ main: null }))).toBeNull();
  });
});

describe('the target itself, as the overview asks it', () => {
  it('is an own planet that is not the main planet, whatever runs on it', () => {
    expect(abandonTargetError(colony, 'u_Anna', 'p1_2_3')).toBeNull();
    expect(
      abandonTargetError({ ...colony, kind: 'moon' }, 'u_Anna', null),
    ).toBe('moon');
    expect(abandonTargetError(colony, 'u_Bert', null)).toBe('unknown');
    expect(abandonTargetError(null, 'u_Anna', null)).toBe('unknown');
    expect(abandonTargetError(colony, 'u_Anna', colony.id)).toBe('main');
  });
});

describe('the references that refuse it (D1)', () => {
  it('refuses a flight from or to the planet or its moon, of any player', () => {
    for (const flight of [
      { from: colony.id, to: 'p1_4_7' },
      { from: 'p1_4_7', to: colony.id },
      { from: moon.id, to: 'p1_4_7' },
      { from: 'p1_4_7', to: moon.id },
    ])
      expect(abandonError(check({ moon, flights: [flight] }))).toBe('flights');
  });

  it('ignores flights elsewhere, and a moon id without the moon', () => {
    const elsewhere = [{ from: 'p1_2_3', to: 'p1_4_7' }];
    expect(abandonError(check({ flights: elsewhere }))).toBeNull();
    expect(
      abandonError(check({ flights: [{ from: moon.id, to: 'p1_2_3' }] })),
    ).toBeNull();
  });

  it('refuses research on the planet or its moon, not elsewhere', () => {
    expect(abandonError(check({ research: colony.id }))).toBe('research');
    expect(abandonError(check({ moon, research: moon.id }))).toBe('research');
    expect(abandonError(check({ research: 'p1_2_3' }))).toBeNull();
  });

  it('refuses a building or shipyard order on the planet or its moon', () => {
    const order = [{ key: 'lf', n: 1, unit: 1000 }];
    expect(abandonError(check({ target: { ...colony, bq: queue } }))).toBe(
      'orders',
    );
    expect(abandonError(check({ target: { ...colony, sq: order } }))).toBe(
      'orders',
    );
    expect(abandonError(check({ moon: { ...moon, bq: queue } }))).toBe(
      'orders',
    );
    expect(abandonError(check({ moon: { ...moon, sq: order } }))).toBe(
      'orders',
    );
  });

  it('names the first refusal: owner, moon, main, flights, research, orders', () => {
    const all = check({
      target: { ...colony, bq: queue },
      main: colony.id,
      flights: [{ from: colony.id, to: 'p1_4_7' }],
      research: colony.id,
    });
    expect(abandonError({ ...all, uid: 'u_Bert' })).toBe('unknown');
    expect(
      abandonError({ ...all, target: { ...all.target!, kind: 'moon' } }),
    ).toBe('moon');
    expect(abandonError(all)).toBe('main');
    expect(abandonError({ ...all, main: null })).toBe('flights');
    expect(abandonError({ ...all, main: null, flights: [] })).toBe('research');
    expect(
      abandonError({ ...all, main: null, flights: [], research: null }),
    ).toBe('orders');
  });
});
