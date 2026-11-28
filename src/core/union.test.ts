// The rules of the attack union (#225, owner, 2026-11-16 and 2026-11-17;
// #466, owner, 2026-11-28): the settings of the round with the classic
// values and the switch, when a union can be planned, who can join under
// the limits, the window of a join (closed at the arrival, the cut-off), and the
// split of the loot by free space. The speed of a joining fleet is tested in
// union-flight.test.ts.
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
  UNION_OFF_REFUSAL,
  UNION_RANGES,
  inviteLimitError,
  joinLimitError,
  joinMessage,
  joinWindow,
  planError,
  planMessage,
  roundSettings,
  splitLoot,
  unionOpen,
} from './union.ts';

const MIN = 60_000;
const KEYS = [
  'roundUnionFleets',
  'roundUnionPlayers',
  'roundUnionCutoff',
  'roundUnionOn',
];
const setting = (key: string) => ROUND_SETTINGS.find((s) => s.key === key)!;

describe('the settings of the round', () => {
  it('are three live number fields with the classic values and the live switch (D3, X1, #466)', () => {
    expect(UNION_DEFAULTS).toEqual({ fleets: 16, players: 5, cutoff: 0 });
    expect(roundSettings.map((s) => [s.key, s.name, s.order, s.def])).toEqual([
      ['roundUnionFleets', 'unionFleets', 200, 16],
      ['roundUnionPlayers', 'unionPlayers', 210, 5],
      ['roundUnionCutoff', 'unionCutoff', 230, 0],
      ['roundUnionOn', 'unionOn', 240, 1],
    ]);
    for (const s of roundSettings) {
      expect(s.live).toBe(true);
      expect(s.kind).toBe('number');
      expect(ROUND_SETTINGS).toContain(setting(s.key));
    }
    // The delay of the classic 30 % rule went with the fixed arrival (8a).
    expect(ROUND_SETTINGS.map((s) => s.key)).not.toContain('roundUnionDelay');
  });
  it('has the switch „Verbandsangriff“ with „An“ and „Aus“, on by default and when nothing is stored', () => {
    const on = setting('roundUnionOn');
    expect(on).toMatchObject({
      label: 'Verbandsangriff',
      min: 0,
      max: 1,
      choices: [
        { value: 1, label: 'An' },
        { value: 0, label: 'Aus' },
      ],
    });
    expect(unionOpen({})).toBe(true);
    expect(unionOpen({ unionOn: 1 })).toBe(true);
    expect(unionOpen({ unionOn: 0 })).toBe(false);
    expect(UNION_OFF_REFUSAL).toBe(
      'Verbandsangriffe sind in dieser Runde abgeschaltet.',
    );
  });
  it('read as the defaults when nothing is stored, and as stored', () => {
    expect(storedValues(() => undefined)).toMatchObject({
      unionFleets: 16,
      unionPlayers: 5,
      unionCutoff: 0,
      unionOn: 1,
    });
    expect(
      storedValues((k) => (k === 'roundUnionCutoff' ? 10 : undefined)),
    ).toMatchObject({ unionCutoff: 10, unionOn: 1 });
    // A stored value of the removed delay is no setting any more.
    expect(
      storedValues((k) => (k === 'roundUnionDelay' ? 50 : undefined)),
    ).not.toHaveProperty('unionDelay');
  });
  it('are rows of the universe settings, checked against their ranges', () => {
    const rows = liveSpecs().filter((s) => KEYS.includes(s.key));
    expect(rows.map((s) => [s.key, s.min, s.max, s.def])).toEqual([
      ['roundUnionFleets', 1, 50, 16],
      ['roundUnionPlayers', 1, 20, 5],
      ['roundUnionCutoff', 0, 1440, 0],
      ['roundUnionOn', 0, 1, 1],
    ]);
    const codes = (input: Record<string, unknown>) =>
      universeErrors(
        { ...DEFAULT_UNIVERSE, ...input },
        { g: 1, s: 1, p: 1 },
      ).map((e) => [e.spec.key, e.code]);
    expect(DEFAULT_UNIVERSE).toMatchObject({
      roundUnionFleets: 16,
      roundUnionOn: 1,
    });
    expect(DEFAULT_UNIVERSE).not.toHaveProperty('roundUnionDelay');
    expect(
      codes({
        roundUnionFleets: 50,
        roundUnionCutoff: 1440,
        roundUnionOn: 0,
      }),
    ).toEqual([]);
    expect(codes({ roundUnionFleets: 51 })).toEqual([
      ['roundUnionFleets', 'range'],
    ]);
    expect(codes({ roundUnionOn: 2 })).toEqual([['roundUnionOn', 'range']]);
    expect(codes({ roundUnionPlayers: 0 })).toEqual([
      ['roundUnionPlayers', 'range'],
    ]);
  });
  it('keep the current value when the admin sends none and refuse a value outside the range', () => {
    const only = roundSettings.map((s) => setting(s.key));
    const current = {
      unionFleets: 16,
      unionPlayers: 5,
      unionCutoff: 0,
      unionOn: 1,
    };
    expect(roundValues(current, { unionCutoff: 10 }, only)).toEqual({
      ...current,
      unionCutoff: 10,
    });
    expect(
      roundRefused(current, { unionFleets: UNION_RANGES.fleets.max }, only),
    ).toEqual([]);
    for (const [name, bad] of [
      ['unionFleets', 0],
      ['unionPlayers', 21],
      ['unionCutoff', -1],
      ['unionCutoff', 1441],
      ['unionCutoff', 1.5],
      ['unionOn', 2],
    ] as const)
      expect(
        roundRefused(current, { [name]: bad }, only).map((s) => s.name),
      ).toEqual([name]);
  });
});

describe('planning a union (#466, A1a)', () => {
  it('needs an arrival in the future and beyond the cut-off, where somebody can still join', () => {
    const at = (now: number, arr: number, cutoff = 0) =>
      planError({ now, arr, limits: { cutoff } });
    expect(at(1000, 1001)).toBeUndefined();
    expect(at(1000, 1000)).toBe('past');
    expect(at(1000, 999)).toBe('past');
    expect(at(1000, Number.NaN)).toBe('past');
    expect(at(0, 10 * MIN, 10)).toBe('cutoff');
    expect(at(0, 10 * MIN + 1, 10)).toBeUndefined();
    expect(planMessage('past', { cutoff: 0 })).toBe(
      'Die Ankunft muss in der Zukunft liegen.',
    );
    expect(planMessage('cutoff', { cutoff: 15 })).toBe(
      'Die Ankunft muss mehr als 15 Minuten in der Zukunft liegen, sonst kann niemand mehr beitreten.',
    );
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

describe('the window of a join (#466)', () => {
  const limits = { cutoff: 0 };
  it('is open before the arrival and closed once the union has arrived', () => {
    expect(joinWindow({ now: 999, arr: 1000, limits })).toBeUndefined();
    expect(joinWindow({ now: 1000, arr: 1000, limits })).toBe('closed');
    expect(joinWindow({ now: 1500, arr: 1000, limits })).toBe('closed');
  });
  it('has no cut-off by default and refuses in the last minutes when the round sets one', () => {
    const arr = 100 * MIN;
    const at = (now: number, cutoff: number) =>
      joinWindow({ now, arr, limits: { cutoff } });
    expect(at(arr - 1, 0)).toBeUndefined();
    expect(at(arr - 10 * MIN - 1, 10)).toBeUndefined();
    // Exactly N minutes before the arrival is inside the last N minutes [V].
    expect(at(arr - 10 * MIN, 10)).toBe('cutoff');
    expect(at(arr - 1, 10)).toBe('cutoff');
  });
  it('words every refusal; too early names the earliest start', () => {
    const l = { fleets: 16, players: 5, cutoff: 15 };
    expect(joinMessage('closed', l)).toBe(
      'Der Angriffsverband ist schon angekommen.',
    );
    expect(joinMessage('cutoff', l)).toBe(
      'In den letzten 15 Minuten vor der Ankunft tritt niemand mehr bei.',
    );
    expect(joinMessage('early', l, 'am 28.11.2026, 03:15:00')).toBe(
      'Deine Flotte wäre selbst mit 10 % zu früh da. Schicke sie frühestens am 28.11.2026, 03:15:00 los.',
    );
    expect(joinMessage('late', l)).toBe(
      'Deine Flotte erreicht das Ziel selbst mit 100 % nicht bis zur Ankunft des Verbands.',
    );
    expect(joinMessage('fleets', l)).toBe(
      'Am Angriffsverband nehmen bereits 16 Flotten teil.',
    );
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
