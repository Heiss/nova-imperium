// The rules of holding (#55, owner, 2026-11-16): the holding times, the
// limits per planet, who counts as an ally under the admin's setting, and
// when a fleet's next event is due.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ALLIES,
  ALLIES_RANGE,
  ALLIES_SETTING,
  HELD_SPY,
  HELD_SPY_SETTING,
  HOLD_HOURS,
  HOLD_LIMITS,
  HOUR_MS,
  cargoOf,
  dueAt,
  holdEnd,
  holdLimitError,
  isAlly,
  isHoldHours,
} from './holding.ts';

describe('holding times', () => {
  it('are the classic 0, 1, 2, 4, 8, 16 and 32 hours', () => {
    expect(HOLD_HOURS).toEqual([0, 1, 2, 4, 8, 16, 32]);
    expect(HOUR_MS).toBe(3_600_000);
    for (const h of HOLD_HOURS) expect(isHoldHours(h)).toBe(true);
  });
  it('refuse any other value', () => {
    for (const h of [-1, 3, 5, 31, 33, 64, 0.5, NaN, '1', null, undefined])
      expect(isHoldHours(h)).toBe(false);
  });
});

describe('who may hold', () => {
  it('is guild, friends or both, both by default (Q2)', () => {
    expect(ALLIES).toEqual({ guild: 1, friends: 2, both: 3 });
    expect(ALLIES_RANGE).toEqual({ min: 1, max: 3, default: 3 });
  });
  it('is a live setting of the round, a selection, after the settings of main (#283, X1)', () => {
    expect(ALLIES_SETTING).toEqual({
      kind: 'number',
      key: 'roundAllies',
      name: 'allies',
      label: 'Halten erlaubt für',
      order: 60,
      min: 1,
      max: 3,
      def: 3,
      refusal: 'Bitte auswählen, wer in der neuen Runde halten darf.',
      choices: [
        { value: 1, label: 'Gilde' },
        { value: 2, label: 'Freunde' },
        { value: 3, label: 'Gilde und Freunde' },
      ],
      live: true,
    });
  });
  it('counts a bond only when the setting names it', () => {
    const none = { guild: false, friends: false };
    const guild = { guild: true, friends: false };
    const friends = { guild: false, friends: true };
    const both = { guild: true, friends: true };
    const table = [none, guild, friends, both].map((bond) =>
      [ALLIES.guild, ALLIES.friends, ALLIES.both].map((a) => isAlly(a, bond)),
    );
    expect(table).toEqual([
      [false, false, false],
      [true, false, true],
      [false, true, true],
      [true, true, true],
    ]);
  });
});

describe('the limits per planet', () => {
  it('are four players and 15 fleets besides the owner (classic)', () => {
    expect(HOLD_LIMITS).toEqual({ players: 4, fleets: 15 });
  });
  it('let a fifth player in only when one of the four is already there', () => {
    const four = ['a', 'b', 'c', 'd'];
    expect(holdLimitError('a', [])).toBeUndefined();
    expect(holdLimitError('e', ['a', 'b', 'c'])).toBeUndefined();
    expect(holdLimitError('e', four)).toBe('holdPlayers');
    expect(holdLimitError('d', four)).toBeUndefined();
    expect(holdLimitError('d', [...four, 'd', 'd'])).toBeUndefined();
  });
  it('refuse a 16th fleet, whoever sends it', () => {
    const fourteen = Array.from({ length: 14 }, (_, i) => 'abcd'[i % 4]!);
    expect(holdLimitError('a', fourteen)).toBeUndefined();
    expect(holdLimitError('a', [...fourteen, 'a'])).toBe('holdFleets');
    expect(holdLimitError('e', [...fourteen, 'a'])).toBe('holdFleets');
  });
});

describe('the next event of a fleet', () => {
  const f = { arr: 100, ret: 500, hold: 50 };
  it('is the arrival on its way out, the end of holding while it holds, else its return', () => {
    expect(dueAt({ ...f, state: 'out' })).toBe(100);
    expect(dueAt({ ...f, state: 'hold' })).toBe(150);
    expect(dueAt({ ...f, state: 'back' })).toBe(500);
    expect(holdEnd({ arr: 100 })).toBe(100);
    expect(dueAt({ arr: 100, ret: 500, state: 'hold' })).toBe(100);
  });
  it('is never before the arrival', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e12 }),
        fc.constantFrom(...HOLD_HOURS),
        (arr, h) => holdEnd({ arr, hold: h * HOUR_MS }) === arr + h * HOUR_MS,
      ),
    );
  });
});

describe('the cargo of several fleets', () => {
  it('adds up each resource', () => {
    expect(cargoOf([])).toEqual({ m: 0, c: 0, d: 0 });
    expect(
      cargoOf([
        { cargo: { m: 1, c: 2, d: 3 } },
        { cargo: { m: 10, c: 20, d: 30 } },
      ]),
    ).toEqual({ m: 11, c: 22, d: 33 });
  });
});

describe('held fleets in the spy report (#55, owner, 2026-11-17)', () => {
  it('are apart from Auspex-Lehre 2 by default, the admin sets 0 to 30', () => {
    expect(HELD_SPY).toEqual({ min: 0, max: 30, default: 2 });
  });
  it('is a live setting of the round, a number, last (#283, X1)', () => {
    expect(HELD_SPY_SETTING).toEqual({
      kind: 'number',
      key: 'roundHeldSpy',
      name: 'heldSpy',
      label: 'Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre',
      order: 70,
      min: 0,
      max: 30,
      def: 2,
      refusal:
        'Bitte für „Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre“ eine ganze Zahl von 0 bis 30 angeben.',
      live: true,
    });
  });
});
