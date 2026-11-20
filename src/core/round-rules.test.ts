// The rules between the settings of a round, built by hand so that they are
// pinned without any feature (#237): the entries shown only while another has
// a value (`shownWhen`), the preview line of a group, and the rule `agrees`
// between the values of a round.
import { describe, expect, it } from 'vitest';
import {
  type RoundGroup,
  type RoundSetting,
  roundPreview,
  roundRefused,
  roundShown,
} from './round.ts';

/** A hand-built number entry; `over` may carry `agrees` and the like. */
const number = (name: string, over: object = {}): RoundSetting =>
  ({
    kind: 'number',
    key: `round${name[0]!.toUpperCase()}${name.slice(1)}`,
    name,
    label: name,
    order: 1,
    min: 0,
    max: 10,
    def: 5,
    ...over,
  }) as RoundSetting;

const names = (list: readonly RoundSetting[]): string[] =>
  list.map((s) => s.name);

describe('the entries shown only while another has a value (#237)', () => {
  const shown = number('colonies', {
    shownWhen: { name: 'research', value: 1 },
  });

  it('are shown when the other field has the value, a switch counting as 1 and 0', () => {
    expect(roundShown(shown, { research: 1 })).toBe(true);
    expect(roundShown(shown, { research: true })).toBe(true);
    expect(roundShown(shown, { research: 0 })).toBe(false);
    expect(roundShown(shown, { research: false })).toBe(false);
    expect(roundShown(shown, { research: 2 })).toBe(false);
    expect(roundShown(shown, {})).toBe(false);
  });

  it('are shown always when the entry names no condition, and by a condition on 0', () => {
    expect(roundShown(number('plain'), {})).toBe(true);
    expect(roundShown(number('plain'), { research: 0 })).toBe(true);
    const zero = number('zero', { shownWhen: { name: 'research', value: 0 } });
    expect(roundShown(zero, { research: 0 })).toBe(true);
    expect(roundShown(zero, { research: 1 })).toBe(false);
  });
});

describe('the preview line of a group (#237)', () => {
  const group: RoundGroup = {
    name: 'limit',
    legend: 'Grenze',
    preview: (values) => JSON.stringify(values),
  };
  const members = [
    number('first', { group }),
    number('second', { group }),
    number('other'),
  ];

  it('is written from the numbers of the members of the group only', () => {
    expect(
      roundPreview(group, { first: 3, second: true, other: 9 }, members),
    ).toBe('{"first":3,"second":1}');
  });

  it('is empty for a group without a preview', () => {
    const bare: RoundGroup = { name: 'bare' };
    const only = [number('first', { group: bare })];
    expect(roundPreview(bare, { first: 3 }, only)).toBe('');
  });
});

describe('a rule between settings of a round (#237)', () => {
  // `reach` may not be above `base`; `base` has no rule of its own.
  const base = number('base');
  const reach = number('reach', {
    order: 2,
    agrees: (value: number, round: Record<string, number>) =>
      value <= round.roundBase!,
  });
  const list = [base, reach];
  const current = { base: 5, reach: 3 };

  it('refuses the entry whose value disagrees with the other values of the round', () => {
    expect(names(roundRefused(current, { reach: 6 }, list))).toEqual(['reach']);
    expect(names(roundRefused(current, { reach: 5 }, list))).toEqual([]);
    // The other value counts as it will be in the new round: sent or current.
    expect(names(roundRefused(current, { base: 2 }, list))).toEqual(['reach']);
    expect(names(roundRefused(current, { base: 3 }, list))).toEqual([]);
    expect(names(roundRefused(current, { base: 2, reach: 2 }, list))).toEqual(
      [],
    );
  });

  it('is asked only once every value is in its range, a value out of it comes first', () => {
    expect(names(roundRefused(current, { reach: 6, base: 11 }, list))).toEqual([
      'base',
    ]);
    expect(names(roundRefused(current, { reach: 11 }, list))).toEqual([
      'reach',
    ]);
  });

  it('gets every value by its stored key as a number, a switch as 1 or 0', () => {
    const seen: Record<string, number>[] = [];
    const flag = {
      kind: 'switch',
      key: 'roundFlag',
      name: 'flag',
      label: 'flag',
      order: 3,
      def: true,
      refusal: 'x',
    } as RoundSetting;
    const spy = number('spy', {
      order: 4,
      agrees: (value: number, round: Record<string, number>) => {
        seen.push({ ...round, value });
        return true;
      },
    });
    roundRefused({ base: 5, reach: 3, flag: true, spy: 7 }, { reach: 4 }, [
      base,
      reach,
      flag,
      spy,
    ]);
    expect(seen).toEqual([
      { roundBase: 5, roundReach: 4, roundFlag: 1, roundSpy: 7, value: 7 },
    ]);
  });

  it('refuses the members of a group together when one disagrees', () => {
    const group: RoundGroup = { name: 'pair' };
    const a = number('a', { group, order: 1 });
    const b = number('b', {
      group,
      order: 2,
      agrees: (value: number, round: Record<string, number>) =>
        value <= round.roundA!,
    });
    expect(
      names(roundRefused({ a: 5, b: 3 }, { pair: { a: 2, b: 4 } }, [a, b])),
    ).toEqual(['b']);
    expect(
      names(roundRefused({ a: 5, b: 3 }, { pair: { a: 4, b: 4 } }, [a, b])),
    ).toEqual([]);
  });
});
