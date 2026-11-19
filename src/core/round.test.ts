// The functions of the registry of the round settings (#214, #283): reading
// the stored values, the request, the check and the values of a new round. They
// run over the settings of the registry, whatever they are (#310): a feature
// pins its own entries in its own test, and the rules for all entries are in
// `round-registry.test.ts`.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { roundDefaults } from '../test/fixtures.ts';
import {
  ROUND_SETTINGS,
  type RoundSetting,
  roundRefused,
  roundRequest,
  roundValues,
  storedValues,
} from './round.ts';

type Values = Record<string, number | boolean>;
const settings: readonly RoundSetting[] = ROUND_SETTINGS;
const defaults = roundDefaults();

/** A valid value other than the default: a switch flips, a number moves to the other end. */
const other = (s: RoundSetting): number | boolean =>
  s.kind === 'switch' ? !s.def : s.def === s.max ? s.min : s.max;
/** Every setting at a value other than its default. */
const changed: Values = Object.fromEntries(
  settings.map((s) => [s.name, other(s)]),
);
/** The name under which a setting is sent: its group, else its own. */
const sentAs = (s: RoundSetting): string => s.group?.name ?? s.name;
/** What the admin sends to set one setting, the rest of a group as `current`. */
const send = (
  s: RoundSetting,
  value: unknown,
  current: Values = defaults,
): Record<string, unknown> => {
  if (!s.group) return { [s.name]: value };
  const members = settings.filter((x) => x.group === s.group);
  const group = Object.fromEntries(
    members.map((x) => [x.name, current[x.name]]),
  );
  return { [s.group.name]: { ...group, [s.name]: value } };
};
/** The name of every refused setting. */
const names = (list: readonly RoundSetting[]): string[] =>
  list.map((s) => s.name);
/** What the oracle says about a value: a switch is a boolean, a number a whole number of its range. */
const isValid = (s: RoundSetting, value: unknown): boolean =>
  s.kind === 'switch'
    ? typeof value === 'boolean'
    : Number.isInteger(value) &&
      (value as number) >= s.min &&
      (value as number) <= s.max;

describe('the values stored by a round', () => {
  it('are the default when missing, yes or no for a switch (0 is no, any other number yes), the number as stored', () => {
    expect(storedValues(() => undefined)).toEqual(
      Object.fromEntries(settings.map((s) => [s.name, s.def])),
    );
    const stored = Object.fromEntries(
      settings.map((s) => [
        s.key,
        s.kind === 'switch' ? Number(other(s)) : (other(s) as number),
      ]),
    );
    expect(storedValues((k) => stored[k])).toEqual(changed);
    for (const s of settings.filter((x) => x.kind === 'switch')) {
      const read = (value: number) =>
        storedValues((k) => (k === s.key ? value : undefined))[s.name];
      expect([read(0), read(1), read(2), read(-1)]).toEqual([
        false,
        true,
        true,
        true,
      ]);
    }
  });
});

describe('the request „reset“ of a dialog', () => {
  it('holds every setting under its name and a group as one object of its members', () => {
    const request = roundRequest(changed);
    const groups = new Set(settings.flatMap((s) => s.group?.name ?? []));
    expect(Object.keys(request).sort()).toEqual(
      [
        ...settings.filter((s) => !s.group).map((s) => s.name),
        ...groups,
      ].sort(),
    );
    for (const s of settings)
      expect(
        s.group ? (request[s.group.name] as Values)[s.name] : request[s.name],
        s.key,
      ).toBe(changed[s.name]);
    for (const group of groups)
      expect(Object.keys(request[group] as Values).sort()).toEqual(
        names(settings.filter((s) => s.group?.name === group)).sort(),
      );
  });
});

describe('the check of a new round', () => {
  it('takes every setting at its bounds, its default and both switch values', () => {
    for (const s of settings) {
      const values =
        s.kind === 'switch' ? [true, false] : [s.min, s.max, s.def];
      for (const value of values) {
        const data = send(s, value);
        // A rule between settings (#237) may refuse a value beside the defaults.
        const round = Object.fromEntries(
          settings.map((x) => [x.key, Number(defaults[x.name])]),
        );
        round[s.key] = Number(value);
        const agrees =
          s.kind !== 'number' || !s.agrees || s.agrees(Number(value), round);
        expect(names(roundRefused(defaults, data)), s.key).toEqual(
          agrees ? [] : [s.name],
        );
        expect(roundValues(defaults, data)[s.name], s.key).toBe(value);
      }
    }
  });

  it('keeps the current values that are not sent and changes only the one sent', () => {
    expect(roundRefused(changed, {})).toEqual([]);
    expect(roundValues(changed, {})).toEqual(changed);
    expect(roundValues(defaults, {})).toEqual(defaults);
    for (const s of settings)
      expect(
        roundValues(changed, send(s, defaults[s.name], changed)),
        s.key,
      ).toEqual({
        ...changed,
        [s.name]: defaults[s.name],
      });
  });

  it('refuses a value that is not yes or no, or not a whole number of the range', () => {
    for (const s of settings) {
      const wrong =
        s.kind === 'switch'
          ? ['true', 0, 1, null, {}]
          : [s.min - 1, s.max + 1, s.min + 0.5, String(s.min), null, true, NaN];
      for (const value of wrong)
        expect(
          names(roundRefused(defaults, send(s, value))),
          `${s.key} ${String(value)}`,
        ).toEqual([s.name]);
    }
  });

  it('names the first refused setting in the order of the registry, with the members of its group', () => {
    const data: Record<string, unknown> = {};
    for (const s of settings) data[sentAs(s)] = s.group ? {} : null;
    for (const s of settings) {
      if (data[sentAs(s)] === undefined) continue;
      const first = settings.filter((x) => sentAs(x) === sentAs(s));
      expect(names(roundRefused(defaults, data)), s.key).toEqual(names(first));
      delete data[sentAs(s)];
    }
    expect(roundRefused(defaults, data)).toEqual([]);
  });

  it('refuses the wrong members of a group together, once per group', () => {
    const groups = new Set(settings.flatMap((s) => s.group?.name ?? []));
    for (const group of groups) {
      const members = settings.filter((s) => s.group?.name === group);
      expect(names(roundRefused(defaults, { [group]: {} })), group).toEqual(
        names(members),
      );
      expect(names(roundRefused(defaults, { [group]: null })), group).toEqual(
        names(members),
      );
      // One member sent, the others missing: only the others are refused.
      const first = members[0]!;
      expect(
        names(roundRefused(defaults, { [group]: { [first.name]: first.def } })),
        group,
      ).toEqual(names(members.slice(1)));
    }
  });

  it('refuses exactly what is not valid for the setting (property)', () => {
    const value = fc.oneof(
      fc.boolean(),
      fc.integer(),
      fc.constant(undefined),
      fc.anything(),
    );
    fc.assert(
      fc.property(fc.constantFrom(...settings), value, (s, v) => {
        // A value not sent keeps the current one; a member of a group is read as null.
        const kept = v === undefined && !s.group;
        expect(names(roundRefused(defaults, send(s, v)))).toEqual(
          kept || isValid(s, v) ? [] : [s.name],
        );
      }),
    );
  });
});
