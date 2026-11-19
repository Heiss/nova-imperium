// The rules of the attack union (#225, owner, 2026-11-16 and 2026-11-17): the
// four settings of the round with the classic values, who can open a union,
// who can join under the limits, the arrival of the union when a fleet joins
// (the 30 % rule, the cut-off), and the split of the loot by free space.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  ROUND_SETTINGS,
  roundRefused,
  roundValues,
  storedValues,
} from './round.ts';
import { DEFAULT_UNIVERSE, liveSpecs, universeErrors } from './universe.ts';
import {
  UNION_DEFAULTS,
  UNION_RANGES,
  delayed,
  foundError,
  inviteLimitError,
  joinLimitError,
  joinTiming,
  roundSettings,
  splitLoot,
} from './union.ts';

const MIN = 60_000;
const KEYS = [
  'roundUnionFleets',
  'roundUnionPlayers',
  'roundUnionDelay',
  'roundUnionCutoff',
];
const setting = (key: string) => ROUND_SETTINGS.find((s) => s.key === key)!;

describe('the settings of the round', () => {
  it('are four live number fields with the classic values as defaults (D3, X1)', () => {
    expect(UNION_DEFAULTS).toEqual({
      fleets: 16,
      players: 5,
      delay: 30,
      cutoff: 0,
    });
    expect(roundSettings.map((s) => [s.key, s.name, s.order, s.def])).toEqual([
      ['roundUnionFleets', 'unionFleets', 200, 16],
      ['roundUnionPlayers', 'unionPlayers', 210, 5],
      ['roundUnionDelay', 'unionDelay', 220, 30],
      ['roundUnionCutoff', 'unionCutoff', 230, 0],
    ]);
    for (const s of roundSettings) {
      expect(s.live).toBe(true);
      expect(s.kind).toBe('number');
      expect(ROUND_SETTINGS).toContain(setting(s.key));
    }
  });
  it('read as the defaults when nothing is stored, and as stored', () => {
    expect(storedValues(() => undefined)).toMatchObject({
      unionFleets: 16,
      unionPlayers: 5,
      unionDelay: 30,
      unionCutoff: 0,
    });
    expect(
      storedValues((k) => (k === 'roundUnionCutoff' ? 10 : undefined)),
    ).toMatchObject({ unionCutoff: 10, unionDelay: 30 });
  });
  it('are rows of the universe settings, checked against their ranges', () => {
    const rows = liveSpecs().filter((s) => KEYS.includes(s.key));
    expect(rows.map((s) => [s.key, s.min, s.max, s.def])).toEqual([
      ['roundUnionFleets', 1, 50, 16],
      ['roundUnionPlayers', 1, 20, 5],
      ['roundUnionDelay', 0, 100, 30],
      ['roundUnionCutoff', 0, 1440, 0],
    ]);
    const codes = (input: Record<string, unknown>) =>
      universeErrors(
        { ...DEFAULT_UNIVERSE, ...input },
        { g: 1, s: 1, p: 1 },
      ).map((e) => [e.spec.key, e.code]);
    expect(DEFAULT_UNIVERSE).toMatchObject({
      roundUnionFleets: 16,
      roundUnionDelay: 30,
    });
    expect(
      codes({
        roundUnionFleets: 50,
        roundUnionDelay: 0,
        roundUnionCutoff: 1440,
      }),
    ).toEqual([]);
    expect(codes({ roundUnionFleets: 51 })).toEqual([
      ['roundUnionFleets', 'range'],
    ]);
    expect(codes({ roundUnionDelay: 101 })).toEqual([
      ['roundUnionDelay', 'range'],
    ]);
    expect(codes({ roundUnionPlayers: 0 })).toEqual([
      ['roundUnionPlayers', 'range'],
    ]);
  });
  it('keep the current value when the admin sends none and refuse a value outside the range', () => {
    const only = roundSettings.map((s) => setting(s.key));
    const current = {
      unionFleets: 16,
      unionPlayers: 5,
      unionDelay: 30,
      unionCutoff: 0,
    };
    expect(roundValues(current, { unionDelay: 10 }, only)).toEqual({
      ...current,
      unionDelay: 10,
    });
    expect(
      roundRefused(current, { unionFleets: UNION_RANGES.fleets.max }, only),
    ).toEqual([]);
    for (const [name, bad] of [
      ['unionFleets', 0],
      ['unionPlayers', 21],
      ['unionDelay', -1],
      ['unionCutoff', 1441],
      ['unionDelay', 1.5],
    ] as const)
      expect(
        roundRefused(current, { [name]: bad }, only).map((s) => s.name),
      ).toEqual([name]);
  });
});

describe('opening a union', () => {
  const attack = {
    mission: 'attack',
    state: 'out',
    arr: 100,
    recalled: false,
  } as const;
  it('takes a Sturmangriff on its way that has not arrived', () => {
    expect(foundError(attack, 99, false)).toBeUndefined();
  });
  it('refuses every other mission, a fleet that is not out, one that has arrived, a gift, a union already', () => {
    expect(foundError({ ...attack, mission: 'transport' }, 0, false)).toBe(
      'notAttack',
    );
    expect(foundError({ ...attack, mission: 'hold' }, 0, false)).toBe(
      'notAttack',
    );
    expect(foundError({ ...attack, state: 'back' }, 0, false)).toBe('notOut');
    expect(foundError({ ...attack, state: 'hold' }, 0, false)).toBe('notOut');
    expect(foundError({ ...attack, recalled: true }, 0, false)).toBe('notOut');
    expect(foundError({ ...attack, gift: true }, 0, false)).toBe('notOut');
    expect(foundError(attack, 100, false)).toBe('started');
    expect(foundError(attack, 101, false)).toBe('started');
    expect(foundError(attack, 99, true)).toBe('inUnion');
  });
});

describe('joining a union: the limits', () => {
  const limits = { fleets: 16, players: 5 };
  const union = (owners: string[], invited: string[] = []) => ({
    leader: owners[0] ?? 'a',
    owners,
    invited,
  });
  it('needs an invitation, except for the leader and the players already in', () => {
    expect(joinLimitError(union(['a', 'b']), 'c', limits)).toBe('notInvited');
    expect(
      joinLimitError(union(['a', 'b'], ['c']), 'c', limits),
    ).toBeUndefined();
    expect(joinLimitError(union(['a', 'b']), 'a', limits)).toBeUndefined();
    expect(joinLimitError(union(['a', 'b']), 'b', limits)).toBeUndefined();
  });
  it('lets the 16th fleet in and refuses the 17th, whoever sends it', () => {
    const fifteen = Array.from({ length: 15 }, (_, i) => 'ab'[i % 2]!);
    expect(joinLimitError(union(fifteen), 'a', limits)).toBeUndefined();
    const sixteen = [...fifteen, 'a'];
    expect(joinLimitError(union(sixteen), 'a', limits)).toBe('fleets');
    expect(joinLimitError(union(sixteen, ['c']), 'c', limits)).toBe('fleets');
  });
  it('lets the 5th player in and refuses the 6th, but another fleet of one of the five', () => {
    const four = ['a', 'b', 'c', 'd'];
    expect(joinLimitError(union(four, ['e']), 'e', limits)).toBeUndefined();
    const five = [...four, 'e'];
    expect(joinLimitError(union(five, ['f']), 'f', limits)).toBe('players');
    expect(joinLimitError(union(five), 'e', limits)).toBeUndefined();
  });
  it('follows the limits of the round', () => {
    expect(
      joinLimitError(union(['a', 'b'], ['c']), 'c', { fleets: 2, players: 5 }),
    ).toBe('fleets');
    expect(
      joinLimitError(union(['a', 'b'], ['c']), 'c', { fleets: 9, players: 2 }),
    ).toBe('players');
  });
});

describe('inviting', () => {
  it('counts the players and the invited against the limit of players', () => {
    const limits = { players: 3 };
    const union = { leader: 'a', owners: ['a', 'b'], invited: [] as string[] };
    expect(inviteLimitError(union, 'c', limits)).toBeUndefined();
    expect(inviteLimitError({ ...union, invited: ['c'] }, 'd', limits)).toBe(
      'players',
    );
    // An invitation twice, or of a player already in, takes no new place.
    expect(
      inviteLimitError({ ...union, invited: ['c'] }, 'c', limits),
    ).toBeUndefined();
    expect(
      inviteLimitError({ ...union, invited: ['c'] }, 'b', limits),
    ).toBeUndefined();
  });
});

describe('the arrival of the union when a fleet joins', () => {
  const limits = { delay: 30, cutoff: 0 };
  // The union arrives in 1000 ms; the joining fleet needs `flight`.
  const timing = (flight: number, over = {}) =>
    joinTiming({ now: 0, arr: 1000, flight, limits: { ...limits, ...over } });
  it('lets a fleet that is there in time wait and arrive with the others', () => {
    expect(timing(400)).toEqual({ arr: 1000 });
    expect(timing(1000)).toEqual({ arr: 1000 });
  });
  it('lets a later fleet delay the union by at most 30 % of the remaining flight time', () => {
    expect(timing(1001)).toEqual({ arr: 1001 });
    expect(timing(1300)).toEqual({ arr: 1300 });
    expect(timing(1301)).toEqual({ error: 'delay' });
    expect(timing(5000)).toEqual({ error: 'delay' });
  });
  it('counts the percentage of the time that is left, not of the whole flight', () => {
    expect(joinTiming({ now: 600, arr: 1000, flight: 500, limits })).toEqual({
      arr: 1100,
    });
    expect(joinTiming({ now: 600, arr: 1000, flight: 521, limits })).toEqual({
      error: 'delay',
    });
  });
  it('follows the percentage of the round: none at 0, anything at 100 and more', () => {
    expect(timing(1001, { delay: 0 })).toEqual({ error: 'delay' });
    expect(timing(1000, { delay: 0 })).toEqual({ arr: 1000 });
    expect(timing(2000, { delay: 100 })).toEqual({ arr: 2000 });
    expect(timing(2001, { delay: 100 })).toEqual({ error: 'delay' });
  });
  it('is closed once the union has arrived', () => {
    expect(joinTiming({ now: 1000, arr: 1000, flight: 1, limits })).toEqual({
      error: 'closed',
    });
    expect(joinTiming({ now: 1500, arr: 1000, flight: 1, limits })).toEqual({
      error: 'closed',
    });
  });
  it('has no cut-off by default and refuses in the last minutes when the round sets one', () => {
    const arr = 100 * MIN;
    const at = (now: number, cutoff: number) =>
      joinTiming({ now, arr, flight: 1, limits: { delay: 30, cutoff } });
    expect(at(arr - 1, 0)).toEqual({ arr });
    expect(at(arr - 11 * MIN, 10)).toEqual({ arr });
    // Exactly N minutes before the arrival is inside the last N minutes [V].
    expect(at(arr - 10 * MIN, 10)).toEqual({ error: 'cutoff' });
    expect(at(arr - 1, 10)).toEqual({ error: 'cutoff' });
  });
  it('is never earlier than the union and never later than the rule allows', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1e9 }),
        fc.integer({ min: 1, max: 1e9 }),
        fc.integer({ min: 0, max: 100 }),
        (left, flight, delay) => {
          const out = joinTiming({
            now: 0,
            arr: left,
            flight,
            limits: { delay, cutoff: 0 },
          });
          if ('error' in out) return flight > left;
          return (
            out.arr >= left &&
            (out.arr - left) * 100 <= delay * left &&
            out.arr === Math.max(left, flight)
          );
        },
      ),
    );
  });
  it('moves the arrival and the return of a fleet by the delay', () => {
    expect(delayed({ arr: 100, ret: 250 }, 30)).toEqual({ arr: 130, ret: 280 });
  });
});

describe('the split of the loot by free cargo space (Q1)', () => {
  const sum = (shares: { m: number; c: number; d: number }[]) =>
    shares.reduce((s, x) => s + x.m + x.c + x.d, 0);
  it('gives every fleet its share of each resource by its free space', () => {
    expect(splitLoot({ m: 60, c: 30, d: 0 }, [100, 200, 0])).toEqual([
      { m: 20, c: 10, d: 0 },
      { m: 40, c: 20, d: 0 },
      { m: 0, c: 0, d: 0 },
    ]);
  });
  it('gives a fleet alone everything', () => {
    expect(splitLoot({ m: 5, c: 4, d: 3 }, [12])).toEqual([
      { m: 5, c: 4, d: 3 },
    ]);
  });
  it('gives the units that rounding leaves to the first fleets with room, none above the space', () => {
    // 10 and 10 of space, 15 Adamant: 7 and 7, the odd unit to the first.
    expect(splitLoot({ m: 15, c: 0, d: 0 }, [10, 10])).toEqual([
      { m: 8, c: 0, d: 0 },
      { m: 7, c: 0, d: 0 },
    ]);
    // The first is full with 3, so the rest goes to the second.
    expect(splitLoot({ m: 4, c: 0, d: 0 }, [3, 1])).toEqual([
      { m: 3, c: 0, d: 0 },
      { m: 1, c: 0, d: 0 },
    ]);
  });
  it('gives nothing when there is no room', () => {
    expect(splitLoot({ m: 9, c: 9, d: 9 }, [0, 0])).toEqual([
      { m: 0, c: 0, d: 0 },
      { m: 0, c: 0, d: 0 },
    ]);
    expect(splitLoot({ m: 9, c: 9, d: 9 }, [])).toEqual([]);
  });
  it('hands out all of the loot and no fleet more than it carries, when the loot fits the space', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 1e6 }), {
          minLength: 1,
          maxLength: 6,
        }),
        fc.tuple(
          fc.integer({ min: 0, max: 1e6 }),
          fc.integer({ min: 0, max: 1e6 }),
          fc.integer({ min: 0, max: 1e6 }),
        ),
        (free, [m, c, d]) => {
          const space = free.reduce((s, n) => s + n, 0);
          fc.pre(m + c + d <= space);
          const shares = splitLoot({ m, c, d }, free);
          return (
            sum(shares) === m + c + d &&
            shares.every((x, i) => x.m + x.c + x.d <= free[i]!)
          );
        },
      ),
    );
  });
});
