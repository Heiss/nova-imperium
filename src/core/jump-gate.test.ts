// The rules of the Warp-Tor that the owner decided (#53, #230, 2026-11-13):
// the cooldown table by the level of the starting gate, which gate is
// ready, and why a jump cannot start.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SHIPS, canFly } from './catalog.ts';
import {
  type Gate,
  gateCooldown,
  gateCooldownMs,
  gateLevel,
  gateReady,
  jumpError,
  moveShips,
  targetError,
} from './jump-gate.ts';
import type { Planet } from './types.ts';

const NOW = 1_800_000_000_000;

const gate = (over: Partial<Gate> = {}): Gate => ({
  id: 'm1_2_3',
  kind: 'moon',
  owner: 'u_Anna',
  b: { moonbase: 1, jumpgate: 1 },
  ready: 0,
  ...over,
});

const target = (over: Partial<Gate> = {}): Gate =>
  gate({ id: 'm2_5_9', ...over });

describe('the cooldown of the Warp-Tor', () => {
  it('has the decided minutes for levels 1 to 15 (owner, 2026-11-13)', () => {
    const levels = Array.from({ length: 15 }, (_, i) => i + 1);
    expect(levels.map(gateCooldown)).toEqual([
      60, 53, 47, 41, 36, 32, 28, 25, 21, 17, 16, 14, 13, 11, 10,
    ]);
  });

  it('stays at 10 minutes from level 15 on', () => {
    for (const level of [15, 16, 20, 30, 100])
      expect(gateCooldown(level), String(level)).toBe(10);
  });

  it('is 0 without a gate', () => {
    expect(gateCooldown(0)).toBe(0);
    expect(gateCooldown(-1)).toBe(0);
    expect(gateCooldownMs(0)).toBe(0);
  });

  it('is in milliseconds the minutes times 60,000', () => {
    expect(gateCooldownMs(1)).toBe(3_600_000);
    expect(gateCooldownMs(15)).toBe(600_000);
  });

  it('never grows with the level and is between 10 and 60 minutes (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (level) => {
        const m = gateCooldown(level);
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThanOrEqual(10);
        expect(m).toBeLessThanOrEqual(60);
        expect(gateCooldown(level + 1)).toBeLessThanOrEqual(m);
      }),
    );
  });

  it('lies between the owiki.de values, as the interpolation rounds them', () => {
    // 5: 36 and 10: 17 → 6 to 9; 10: 17 and 15: 10 → 11 to 14.
    const linear = (a: number, b: number, at: number, from: number) =>
      Math.round(a + ((b - a) * (at - from)) / 5);
    for (const level of [6, 7, 8, 9])
      expect(gateCooldown(level)).toBe(linear(36, 17, level, 5));
    for (const level of [11, 12, 13, 14])
      expect(gateCooldown(level)).toBe(linear(17, 10, level, 10));
  });
});

describe('the level and readiness of a gate', () => {
  it('reads the Warp-Tor on a moon, nothing on a planet', () => {
    expect(gateLevel({ kind: 'moon', b: { jumpgate: 4 } })).toBe(4);
    expect(gateLevel({ kind: 'moon', b: {} })).toBe(0);
    expect(gateLevel({ kind: 'planet', b: { jumpgate: 4 } })).toBe(0);
  });

  it('is ready when built and its time has come', () => {
    expect(gateReady(gate(), NOW)).toBe(true);
    expect(gateReady(gate({ ready: NOW }), NOW)).toBe(true);
    expect(gateReady(gate({ ready: NOW + 1 }), NOW)).toBe(false);
    expect(gateReady(gate({ b: { moonbase: 1 } }), NOW)).toBe(false);
  });
});

describe('a jump', () => {
  const ships = { lc: 3, bs: 1 };

  it('starts from a ready gate to another own moon with a ready gate', () => {
    expect(jumpError(gate(), target(), ships, NOW)).toBeNull();
    expect(
      jumpError(gate({ ready: NOW }), target({ ready: NOW }), ships, NOW),
    ).toBeNull();
  });

  it('starts only on a moon with a Warp-Tor', () => {
    expect(
      jumpError(gate({ kind: 'planet', id: 'p1_2_3' }), target(), ships, NOW),
    ).toBe('notMoon');
    expect(
      jumpError(gate({ b: { moonbase: 1 } }), target(), ships, NOW),
    ).toBe('noGate');
  });

  it('waits while the starting gate cools down', () => {
    expect(jumpError(gate({ ready: NOW + 1 }), target(), ships, NOW)).toBe(
      'cooling',
    );
  });

  it('goes only to another own moon whose gate is ready', () => {
    expect(jumpError(gate(), null, ships, NOW)).toBe('noTarget');
    expect(
      jumpError(gate(), target({ owner: 'u_Bert' }), ships, NOW),
    ).toBe('noTarget');
    expect(
      jumpError(gate(), target({ kind: 'planet', id: 'p2_5_9' }), ships, NOW),
    ).toBe('noTarget');
    expect(jumpError(gate(), gate(), ships, NOW)).toBe('sameMoon');
    expect(
      jumpError(gate(), target({ b: { moonbase: 2 } }), ships, NOW),
    ).toBe('targetNoGate');
    expect(jumpError(gate(), target({ ready: NOW + 1 }), ships, NOW)).toBe(
      'targetCooling',
    );
  });

  it('needs at least one ship, and only ships that fly', () => {
    expect(jumpError(gate(), target(), {}, NOW)).toBe('noShips');
    expect(jumpError(gate(), target(), { lc: 0 }, NOW)).toBe('noShips');
    expect(jumpError(gate(), target(), { sat: 2 }, NOW)).toBe('stationary');
    expect(jumpError(gate(), target(), { lc: 1, sat: 2 }, NOW)).toBe(
      'stationary',
    );
    for (const key of Object.keys(SHIPS))
      expect(jumpError(gate(), target(), { [key]: 1 }, NOW), key).toBe(
        canFly(key) ? null : 'stationary',
      );
  });

  it('checks the starting gate first, then the target, then the ships', () => {
    const cold = gate({ ready: NOW + 1 });
    expect(jumpError(cold, null, {}, NOW)).toBe('cooling');
    expect(jumpError(gate(), target({ ready: NOW + 1 }), {}, NOW)).toBe(
      'targetCooling',
    );
    expect(targetError(gate(), target(), NOW)).toBeNull();
  });

  it('is refused whenever one of the two gates cools down (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3_600_000 }),
        fc.integer({ min: 0, max: 3_600_000 }),
        fc.integer({ min: 0, max: 3_600_000 }),
        (from, to, now) => {
          const error = jumpError(
            gate({ ready: from }),
            target({ ready: to }),
            ships,
            now,
          );
          if (from > now) expect(error).toBe('cooling');
          else if (to > now) expect(error).toBe('targetCooling');
          else expect(error).toBeNull();
        },
      ),
    );
  });
});

describe('moving the ships', () => {
  const place = (id: string, ships: Planet['ships']) =>
    ({ id, ships }) as Planet;

  it('takes them from the start and adds them at the target', () => {
    const from = place('m1_2_3', { lc: 5, bs: 2, sat: 4 });
    const to = place('m2_5_9', { lc: 1 });
    moveShips(from, to, { lc: 3, bs: 2 });
    expect(from.ships).toEqual({ lc: 2, bs: 0, sat: 4 });
    expect(to.ships).toEqual({ lc: 4, bs: 2 });
  });

  it('keeps the number of ships (property)', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          fc.constantFrom('lc', 'sc', 'bs', 'dstar'),
          fc.integer({ min: 0, max: 1e6 }),
        ),
        fc.dictionary(
          fc.constantFrom('lc', 'sc', 'bs'),
          fc.integer({ min: 0, max: 1e6 }),
        ),
        (have, there) => {
          const from = place('m1_2_3', { ...have });
          const to = place('m2_5_9', { ...there });
          const ships = Object.fromEntries(
            Object.entries(have).map(([k, n]) => [k, Math.floor(n / 2)]),
          );
          moveShips(from, to, ships);
          for (const k of new Set([...Object.keys(have), ...Object.keys(there)]))
            expect((from.ships[k] ?? 0) + (to.ships[k] ?? 0)).toBe(
              (have[k] ?? 0) + (there[k] ?? 0),
            );
        },
      ),
    );
  });
});
