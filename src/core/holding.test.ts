// The rules of holding (#55, owner, 2026-11-16): the holding times, the
// limits per planet, who counts as an ally under the admin's setting, and
// when a fleet's next event is due.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { withoutExplain } from '../test/explain.ts';
import {
  holdOpen,
  turnHomeAt,
  ALLIES,
  ALLIES_RANGE,
  HELD_SPY,
  HOLD_HOURS,
  HOLD_LIMITS,
  HOUR_MS,
  dueAt,
  holdEnd,
  holdLimitError,
  homeAt,
  isAlly,
  isHoldHours,
} from './holding.ts';
import {
  ROUND_SETTINGS,
  roundFieldId,
  roundRefused,
  roundRequest,
  roundValues,
  storedValues,
} from './round.ts';
import { DEFAULT_UNIVERSE, liveSpecs, universeErrors } from './universe.ts';

/** The two settings of holding, as the registry holds them, by their keys. */
const setting = (key: string) => ROUND_SETTINGS.find((s) => s.key === key)!;
const ALLIES_ROW = {
  key: 'roundAllies',
  label: 'Verbündete für Halten und Verband',
  min: 1,
  max: 3,
  def: 3,
  choices: [
    { value: 1, label: 'Gilde' },
    { value: 2, label: 'Freunde' },
    { value: 3, label: 'Gilde und Freunde' },
  ],
};
const HELD_SPY_LABEL = 'Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre';
const HELD_SPY_ROW = {
  key: 'roundHeldSpy',
  label: HELD_SPY_LABEL,
  min: 0,
  max: 30,
  def: 2,
};

describe('the switch „Wache stellen“ (#440, 261a)', () => {
  it('is on with 1 and without a value, off only with an explicit 0', () => {
    expect(holdOpen({ holdOn: 1 })).toBe(true);
    expect(holdOpen({})).toBe(true);
    expect(holdOpen({ holdOn: undefined })).toBe(true);
    expect(holdOpen({ holdOn: 0 })).toBe(false);
  });
});

describe('a hold that turns home (#440, 231a, 4a)', () => {
  const f = { dep: 1000, arr: 1600, hold: 10_000 };
  it('flies home from its place as at the end of its holding time when it holds', () => {
    expect(turnHomeAt({ ...f, state: 'hold' }, 5000)).toEqual({
      ret: 5000 + 600,
    });
    // Its holding time already over: it left at its end.
    expect(turnHomeAt({ ...f, state: 'hold' }, 20_000)).toEqual({
      ret: 11_600 + 600,
    });
  });
  it('flies home from its arrival when it turns there', () => {
    expect(turnHomeAt({ ...f, state: 'out' }, 1600)).toEqual({
      ret: 1600 + 600,
    });
  });
  it('turns back like a recall on its way, as long as it has flown', () => {
    expect(turnHomeAt({ ...f, state: 'out' }, 1200)).toEqual({
      ret: 1200 + 200,
      recalled: true,
    });
  });
});

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
  it('is a live selection of the round, order 100, without a group (#283, #310, X1)', () => {
    expect(withoutExplain(setting('roundAllies'))).toEqual({
      kind: 'number',
      key: 'roundAllies',
      name: 'allies',
      label: 'Verbündete für Halten und Verband',
      order: 100,
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
    expect(roundFieldId(setting('roundAllies'))).toBe('round-allies');
  });
  it('is a row of the universe settings with its choices, checked there, 3 by default (X1)', () => {
    expect(
      withoutExplain(liveSpecs().find((s) => s.key === 'roundAllies')),
    ).toEqual(ALLIES_ROW);
    const codes = (input: Record<string, unknown>) =>
      universeErrors(
        { ...DEFAULT_UNIVERSE, ...input },
        { g: 1, s: 1, p: 1 },
      ).map((e) => [e.spec.key, e.code]);
    expect(DEFAULT_UNIVERSE).toMatchObject({ roundAllies: 3 });
    for (const roundAllies of [1, 2, 3, '2'])
      expect(codes({ roundAllies })).toEqual([]);
    for (const roundAllies of [0, 4, 1.5])
      expect(codes({ roundAllies })).toEqual([['roundAllies', 'range']]);
  });
  it('is read from the stored settings, 3 when missing, and sent with its name', () => {
    expect(storedValues(() => undefined)).toMatchObject({ allies: 3 });
    expect(
      storedValues((k) => (k === 'roundAllies' ? 1 : undefined)),
    ).toMatchObject({ allies: 1 });
    expect(roundRequest({ allies: 2 }, [setting('roundAllies')])).toEqual({
      allies: 2,
    });
  });
  it('keeps the current choice when the admin sends none, refuses a value outside 1 to 3 with its own text', () => {
    const only = [setting('roundAllies')];
    expect(roundValues({ allies: 2 }, {}, only)).toEqual({ allies: 2 });
    expect(roundValues({ allies: 2 }, { allies: 1 }, only)).toEqual({
      allies: 1,
    });
    for (const allies of [1, 2, 3])
      expect(roundRefused({ allies: 3 }, { allies }, only)).toEqual([]);
    for (const allies of [0, 4, 1.5, '1', null])
      expect(
        roundRefused({ allies: 3 }, { allies }, only).map((s) => s.name),
      ).toEqual(['allies']);
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

describe('the return of a fleet that turns home (#55, owner, 2026-11-19)', () => {
  // A flight of 60 there, then 50 of holding.
  const f = { dep: 40, arr: 100, hold: 50 };
  it('is home after a flight as long as the flight there, counted from the turn', () => {
    expect(homeAt(f, 120)).toBe(180);
    expect(homeAt(f, 100)).toBe(160);
    expect(homeAt({ dep: 40, arr: 100 }, 100)).toBe(160);
  });
  it('counts from the end of the holding time when that is over already', () => {
    expect(homeAt(f, 150)).toBe(210);
    expect(homeAt(f, 999)).toBe(210);
    // The same time the end of holding gives a fleet that was sent home on schedule.
    expect(homeAt(f, 999)).toBe(holdEnd(f) + (f.arr - f.dep));
  });
  it('is never earlier than a flight back after the arrival and never later than the planned return', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1e9 }),
        fc.integer({ min: 1, max: 1e6 }),
        fc.constantFrom(...HOLD_HOURS),
        fc.integer({ min: 0, max: 1e12 }),
        (dep, flight, h, t) => {
          const x = { dep, arr: dep + flight, hold: h * HOUR_MS };
          const planned = holdEnd(x) + flight;
          const home = homeAt(x, Math.max(t, x.arr));
          return home >= x.arr + flight && home <= planned;
        },
      ),
    );
  });
});

describe('held fleets in the spy report (#55, owner, 2026-11-17)', () => {
  it('are apart from Auspex-Lehre 2 by default, the admin sets 0 to 30', () => {
    expect(HELD_SPY).toEqual({ min: 0, max: 30, default: 2 });
  });
  it('is a live number field of the round, order 110, without a group (#283, #310, X1)', () => {
    expect(withoutExplain(setting('roundHeldSpy'))).toEqual({
      kind: 'number',
      key: 'roundHeldSpy',
      name: 'heldSpy',
      label: HELD_SPY_LABEL,
      order: 110,
      min: 0,
      max: 30,
      def: 2,
      refusal:
        'Bitte für „Gehaltene Flotten im Auspex-Bericht ab Auspex-Lehre“ eine ganze Zahl von 0 bis 30 angeben.',
      live: true,
    });
    expect(roundFieldId(setting('roundHeldSpy'))).toBe('round-held-spy');
  });
  it('is a row of the universe settings, 0 to 30, checked there, 2 by default (X1)', () => {
    expect(
      withoutExplain(liveSpecs().find((s) => s.key === 'roundHeldSpy')),
    ).toEqual(HELD_SPY_ROW);
    const codes = (input: Record<string, unknown>) =>
      universeErrors(
        { ...DEFAULT_UNIVERSE, ...input },
        { g: 1, s: 1, p: 1 },
      ).map((e) => [e.spec.key, e.code]);
    expect(DEFAULT_UNIVERSE).toMatchObject({ roundHeldSpy: 2 });
    for (const roundHeldSpy of [0, 30, '5'])
      expect(codes({ roundHeldSpy })).toEqual([]);
    for (const roundHeldSpy of [-1, 31, 2.5])
      expect(codes({ roundHeldSpy })).toEqual([['roundHeldSpy', 'range']]);
  });
  it('is read from the stored settings, 2 when missing, and refused outside 0 to 30', () => {
    expect(storedValues(() => undefined)).toMatchObject({ heldSpy: 2 });
    expect(
      storedValues((k) => (k === 'roundHeldSpy' ? 0 : undefined)),
    ).toMatchObject({ heldSpy: 0 });
    const only = [setting('roundHeldSpy')];
    expect(roundValues({ heldSpy: 4 }, {}, only)).toEqual({ heldSpy: 4 });
    for (const heldSpy of [0, 30])
      expect(roundRefused({ heldSpy: 2 }, { heldSpy }, only)).toEqual([]);
    for (const heldSpy of [-1, 31, 2.5, '2', null])
      expect(
        roundRefused({ heldSpy: 2 }, { heldSpy }, only).map((s) => s.name),
      ).toEqual(['heldSpy']);
  });
});
