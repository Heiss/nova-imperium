import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { canFly } from './catalog.ts';
import {
  cargoError,
  holdTimeError,
  recallable,
  recallError,
  startError,
  stayError,
} from './fleet-checks.ts';
import { capacity } from './flight.ts';
import { HOLD_HOURS } from './holding.ts';
import { FLEET_MISSIONS, SILO_MISSIONS } from './missions.ts';
import type { Fleet } from './types.ts';

// The checks of `send` and `recall` beside `sendError` (#214): each code and
// each boundary, in the order of the server.

describe('startError', () => {
  it('knows the missions of the fleet form only', () => {
    expect(FLEET_MISSIONS.length).toBeGreaterThan(0);
    expect(SILO_MISSIONS.length).toBeGreaterThan(0);
    for (const m of FLEET_MISSIONS)
      expect(startError(m, { lf: 1 }, 0, 1)).toBeNull();
    for (const m of [...SILO_MISSIONS, 'unknown', '', 'toString'])
      expect(startError(m, { lf: 1 }, 0, 1)).toBe('mission');
  });

  it('answers the codes in the order of the server', () => {
    expect(startError('unknown', { sat: 1 }, 9, 1)).toBe('mission');
    expect(startError('attack', { sat: 1 }, 9, 1)).toBe('stationary');
    expect(startError('attack', { lf: 1, sat: 1 }, 9, 1)).toBe('stationary');
    expect(startError('attack', { nope: 1 }, 0, 1)).toBe('stationary');
    expect(startError('attack', {}, 9, 1)).toBe('noShips');
    expect(startError('attack', { lf: 0 }, 9, 1)).toBe('noShips');
    expect(startError('spy', {}, 9, 1)).toBe('noProbes');
    expect(startError('spy', { probe: 0 }, 0, 1)).toBe('noProbes');
    expect(startError('survey', {}, 0, 1)).toBe('noProbes');
    expect(startError('spy', { sat: 1 }, 0, 1)).toBe('stationary');
    expect(startError('spy', { probe: 1 }, 1, 1)).toBe('slots');
    expect(startError('attack', { lf: 1 }, 9, 1)).toBe('slots');
    expect(startError('attack', { lf: 1 }, 1, 1)).toBe('slots');
    expect(startError('attack', { lf: 1 }, 0, 1)).toBeNull();
    expect(startError('attack', { lf: 1 }, 1, 2)).toBeNull();
  });

  it('refuses a full set of slots and takes one below it', () => {
    fc.assert(
      fc.property(fc.nat(50), fc.nat(50), (used, slots) => {
        expect(startError('attack', { lf: 1 }, used, slots)).toBe(
          used >= slots ? 'slots' : null,
        );
      }),
    );
  });

  it('answers stationary exactly for a ship that cannot fly', () => {
    const keys = fc.constantFrom('lf', 'sc', 'probe', 'sat', 'metal', 'nope');
    fc.assert(
      fc.property(
        fc.dictionary(keys, fc.integer({ min: 1, max: 9 })),
        (ships) => {
          const flies = Object.keys(ships).every(canFly);
          const empty = !Object.keys(ships).length;
          const expected = !flies ? 'stationary' : empty ? 'noShips' : null;
          expect(startError('attack', ships, 0, 1)).toBe(expected);
        },
      ),
    );
  });
});

describe('holdTimeError', () => {
  it('asks a holding time of a Halten only', () => {
    for (const h of HOLD_HOURS)
      expect(holdTimeError({ holds: true }, h)).toBeNull();
    for (const h of [3, -1, '1', null, undefined, 0.5])
      expect(holdTimeError({ holds: true }, h)).toBe('holdTime');
    for (const h of [3, undefined, 1])
      expect(holdTimeError({ holds: false }, h)).toBeNull();
  });
});

describe('stayError', () => {
  it('refuses more hours than allowed, not as many', () => {
    expect(stayError(4, 4)).toBeNull();
    expect(stayError(5, 4)).toBe('stay');
    expect(stayError(1, 4)).toBeNull();
    fc.assert(
      fc.property(fc.nat(100), fc.nat(100), (chosen, most) => {
        expect(stayError(chosen, most)).toBe(chosen > most ? 'stay' : null);
      }),
    );
  });
});

describe('cargoError', () => {
  const ships = { sc: 2 };
  const room = capacity(ships);

  it('fills the hold exactly, not beyond, with every resource counted', () => {
    expect(room).toBeGreaterThan(3);
    expect(cargoError(ships, { m: room, c: 0, d: 0 }, 1e9, 0)).toBeNull();
    expect(cargoError(ships, { m: room - 2, c: 1, d: 1 }, 1e9, 0)).toBeNull();
    expect(cargoError(ships, { m: room, c: 1, d: 0 }, 1e9, 0)).toBe('hold');
    expect(cargoError(ships, { m: 0, c: room, d: 1 }, 1e9, 0)).toBe('hold');
    expect(cargoError(ships, { m: 1, c: 0, d: room }, 1e9, 0)).toBe('hold');
  });

  it('asks the hold before the Promethium', () => {
    expect(cargoError(ships, { m: room + 1, c: 0, d: 0 }, 0, 99)).toBe('hold');
  });

  it('needs the fuel and the Promethium loaded, exactly', () => {
    expect(cargoError(ships, { m: 0, c: 0, d: 3 }, 10, 7)).toBeNull();
    expect(cargoError(ships, { m: 0, c: 0, d: 3 }, 9, 7)).toBe('fuel');
    expect(cargoError(ships, { m: 5, c: 5, d: 0 }, 7, 7)).toBeNull();
    expect(cargoError(ships, { m: 0, c: 0, d: 0 }, 6, 7)).toBe('fuel');
    fc.assert(
      fc.property(
        fc.nat(room),
        fc.nat(1000),
        fc.nat(1000),
        (d, stock, fuel) => {
          expect(cargoError(ships, { m: 0, c: 0, d }, stock, fuel)).toBe(
            stock < fuel + d ? 'fuel' : null,
          );
        },
      ),
    );
  });
});

const T = 10_000;
const fleet = (over: Partial<Fleet> = {}): Fleet => ({
  id: 'f1',
  owner: 'u_a',
  from: 'p1_1_1',
  fromC: { g: 1, s: 1, p: 1 },
  to: 'p1_1_2',
  toC: { g: 1, s: 1, p: 2 },
  mission: 'attack',
  ships: { lf: 1 },
  cargo: { m: 0, c: 0, d: 0 },
  dep: T - 100,
  arr: T + 100,
  ret: T + 300,
  state: 'out',
  recalled: false,
  fuel: 0,
  ...over,
});

describe('recallable', () => {
  it('is on the way out before the arrival, and while it holds before the end', () => {
    expect(recallable(fleet({ arr: T + 1 }), T)).toBe(true);
    expect(recallable(fleet({ arr: T }), T)).toBe(false);
    expect(recallable(fleet({ state: 'back', ret: T + 99 }), T)).toBe(false);
    const holds = { state: 'hold', arr: T - 50 } as const;
    expect(recallable(fleet({ ...holds, hold: 51 }), T)).toBe(true);
    expect(recallable(fleet({ ...holds, hold: 50 }), T)).toBe(false);
    expect(recallable(fleet({ ...holds }), T)).toBe(false);
  });
});

describe('recallError', () => {
  it('answers gone before the gift, and gone for missiles', () => {
    expect(recallError(null, 'u_a', T)).toBe('gone');
    expect(recallError(undefined, 'u_a', T)).toBe('gone');
    expect(recallError(fleet(), 'u_b', T)).toBe('gone');
    expect(recallError(fleet({ gift: true }), 'u_b', T)).toBe('gone');
    expect(recallError(fleet({ gift: true, arr: T }), 'u_a', T)).toBe('gone');
    expect(recallError(fleet({ gift: true }), 'u_a', T)).toBe('gift');
    expect(
      recallError(fleet({ gift: true, mission: 'missile' }), 'u_a', T),
    ).toBe('gift');
    expect(recallError(fleet({ mission: 'missile' }), 'u_a', T)).toBe('gone');
    expect(recallError(fleet(), 'u_a', T)).toBeNull();
  });

  it('takes an own fleet of the form exactly while it can be called back', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FLEET_MISSIONS),
        fc.integer({ min: -500, max: 500 }),
        fc.boolean(),
        (mission, arr, own) => {
          const f = fleet({ mission, arr: T + arr });
          expect(recallError(f, own ? 'u_a' : 'u_b', T)).toBe(
            own && arr > 0 ? null : 'gone',
          );
        },
      ),
    );
  });
});
