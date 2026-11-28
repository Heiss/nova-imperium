// The presets and the marks of the round settings (#441, owner, 2026-11-27,
// 234, 235b, 237a): „Standard“ is the defaults of the registry; a later
// preset gives a value for every entry; under „Universum“ a preset changes
// only the `live` settings.
import { describe, expect, it, test } from 'vitest';
import {
  MARK_LABELS,
  PRESETS,
  presetValue,
  presetValues,
  ROUND_SETTINGS,
  type RoundSetting,
} from './round.ts';

const make = (over: object): RoundSetting =>
  ({ key: 'roundX', label: 'X', order: 1, ...over }) as unknown as RoundSetting;

describe('the presets of the round settings (#441)', () => {
  it('has „Standard“ only for now (234)', () => {
    expect(PRESETS).toEqual([{ id: 'standard', name: 'Standard' }]);
  });

  it('gives every entry a value in every preset; „Standard“ is its default', () => {
    for (const { id } of PRESETS)
      for (const s of ROUND_SETTINGS)
        expect(presetValue(s, id), `${id}: ${s.key}`).toBeDefined();
    for (const s of ROUND_SETTINGS)
      expect(presetValue(s, 'standard')).toBe(s.def);
  });

  it('fills every entry in „Neue Runde“, by its name, with the defaults', () => {
    const values = presetValues('standard', false);
    expect(Object.keys(values)).toEqual(ROUND_SETTINGS.map((s) => s.name));
    for (const s of ROUND_SETTINGS) expect(values[s.name]).toBe(s.def);
  });

  it('fills only the live entries under „Universum“, by their stored key (237a)', () => {
    const values = presetValues('standard', true);
    const live = ROUND_SETTINGS.filter((s) => s.kind === 'number' && s.live);
    expect(Object.keys(values)).toEqual(live.map((s) => s.key));
    expect(values).not.toHaveProperty('roundGuilds');
    expect(values).not.toHaveProperty('roundAchievements');
    expect(values.roundMarketOn).toBe(1);
  });

  it('takes the value of a later preset from the entry, and the default for „Standard“', () => {
    const settings = [
      make({
        kind: 'number',
        name: 'a',
        key: 'roundA',
        def: 3,
        live: true,
        presets: { standard: 9 },
      }),
      make({ kind: 'switch', name: 'b', key: 'roundB', def: true }),
      make({ kind: 'number', name: 'c', key: 'roundC', def: 7 }),
    ];
    // „Standard“ is always the default, whatever an entry says.
    expect(presetValues('standard', false, settings)).toEqual({
      a: 3,
      b: true,
      c: 7,
    });
    expect(presetValues('standard', true, settings)).toEqual({ roundA: 3 });
    const other = 'later' as never;
    expect(presetValue(make({ def: 1, presets: { later: 5 } }), other)).toBe(5);
    expect(presetValue(make({ def: 1 }), other)).toBeUndefined();
    // An entry without a value in the preset is left out, not set empty.
    expect(
      presetValues(other, false, [
        make({ name: 'x', def: 1, presets: { later: 5 } }),
        make({ name: 'y', def: 2 }),
      ]),
    ).toStrictEqual({ x: 5 });
  });

  it('takes only number entries into „Universum“, whatever else says live', () => {
    const settings = [
      make({ kind: 'number', name: 'a', key: 'roundA', def: 3, live: true }),
      make({ kind: 'switch', name: 'b', key: 'roundB', def: true, live: true }),
    ];
    expect(presetValues('standard', true, settings)).toStrictEqual({
      roundA: 3,
    });
  });
});

describe('the marks of the round settings (#441, 235b)', () => {
  it('words the marks „klassisch“ and „neu“', () => {
    expect(MARK_LABELS).toEqual({ classic: 'klassisch', new: 'neu' });
  });

  it('has only known marks, and none yet until the owner confirms the list', () => {
    const marked = ROUND_SETTINGS.filter((s) => s.mark !== undefined);
    for (const s of marked) expect(Object.keys(MARK_LABELS)).toContain(s.mark);
    expect(marked.map((s) => s.key)).toEqual([]);
  });

  test.todo('every entry has a mark once the owner confirms the list (#441)');
});
