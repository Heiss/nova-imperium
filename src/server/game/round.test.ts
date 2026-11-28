// The registry of the round settings on the server (#283): a new entry is
// read with its default, checked and stored by a new round, kept when the
// admin does not send it, and a `live` entry is a row of the universe
// settings under the same key.
import { describe, expect, it } from 'vitest';
import {
  ROUND_SETTINGS,
  type RoundNumber,
  type RoundSetting,
} from '../../core/round.ts';
import { liveSpecs, universeErrors } from '../../core/universe.ts';
import { roundDefaults } from '../../test/fixtures.ts';
import { testCtx } from '../test-helpers.ts';
import { rangeError, roundRules, startRoundRules } from './round.ts';

/** A new feature's entry: whole hours from 1 to 720, 24 by default, live. */
const HOURS: RoundNumber<'testHours'> = {
  kind: 'number',
  key: 'roundTestHours',
  name: 'testHours',
  label: 'Testdauer (Stunden)',
  order: 100,
  min: 1,
  max: 720,
  def: 24,
  live: true,
};

/** A choice with its own refusal, not live. */
const CHOICE: RoundNumber<'testChoice'> = {
  kind: 'number',
  key: 'roundTestChoice',
  name: 'testChoice',
  label: 'Testauswahl',
  order: 110,
  min: 1,
  max: 3,
  def: 3,
  refusal: 'Bitte eine Testauswahl treffen.',
  choices: [
    { value: 1, label: 'Eins' },
    { value: 2, label: 'Zwei' },
    { value: 3, label: 'Drei' },
  ],
};

const settings: readonly RoundSetting[] = [...ROUND_SETTINGS, HOURS, CHOICE];

/** Data in which every given setting is wrong: a group as an empty object, the rest null. */
const wrongData = (list: readonly RoundSetting[]): Record<string, unknown> =>
  Object.fromEntries(
    list.map((s) => [s.group?.name ?? s.name, s.group ? {} : null]),
  );

/** The refusal of settings: their own wording, each once, else the range (#214). */
const wording = (list: readonly RoundSetting[]): string =>
  [...new Set(list.map((s) => s.refusal ?? rangeError(s as RoundNumber)))].join(
    ' ',
  );
const valuesOf = (ctx: ReturnType<typeof testCtx>) =>
  roundRules(ctx, settings) as unknown as Record<string, unknown>;

describe('a new entry of the registry (#283)', () => {
  it('starts with its default in an existing universe', () => {
    expect(valuesOf(testCtx())).toMatchObject({ testHours: 24, testChoice: 3 });
  });

  it('is set by a new round, stored under its key and kept when not sent', () => {
    const ctx = testCtx();
    const next = startRoundRules(
      ctx,
      { testHours: 48, testChoice: 1 },
      settings,
    );
    expect(next).toMatchObject({ number: 2, testHours: 48, testChoice: 1 });
    expect(ctx.admin.setting('roundTestHours')).toBe(48);
    expect(ctx.admin.setting('roundTestChoice')).toBe(1);
    startRoundRules(ctx, {}, settings);
    // The settings of the registry that were not sent keep their values.
    expect(valuesOf(ctx)).toMatchObject({
      ...roundDefaults(),
      // The first new round took the default of the planet limit: 6, not the unlimited of the round before (#237).
      colonyBase: 6,
      number: 3,
      testHours: 48,
      testChoice: 1,
    });
  });

  it('is refused with the range wording, or its own, and nothing is stored', () => {
    const ctx = testCtx();
    for (const testHours of [0, 721, 1.5, '24', null])
      expect(() => startRoundRules(ctx, { testHours }, settings)).toThrow(
        'Testdauer (Stunden): ganze Zahl von 1 bis 720.',
      );
    expect(() => startRoundRules(ctx, { testChoice: 4 }, settings)).toThrow(
      'Bitte eine Testauswahl treffen.',
    );
    // A setting of the registry is checked before the new ones (they come last).
    const first = ROUND_SETTINGS[0]!;
    expect(() =>
      startRoundRules(ctx, { ...wrongData([first]), testHours: 0 }, settings),
    ).toThrow(new Error(wording([first])));
    expect(ctx.admin.setting('roundTestHours')).toBeUndefined();
    expect(roundRules(ctx).number).toBe(1);
  });

  it('words every refused member of a group, each sentence once', () => {
    const group = { name: 'testPair' };
    const pair: readonly RoundSetting[] = [
      { ...HOURS, group },
      {
        ...HOURS,
        key: 'roundTestDays',
        name: 'testDays',
        label: 'Testtage',
        max: 30,
        group,
      },
      { ...CHOICE, group },
      { ...CHOICE, key: 'roundTestOther', name: 'testOther', group },
    ];
    const ctx = testCtx();
    const data = {
      testPair: { testHours: 0, testDays: 31, testChoice: 4, testOther: 0 },
    };
    expect(() => startRoundRules(ctx, data, pair)).toThrow(
      new Error(
        'Testdauer (Stunden): ganze Zahl von 1 bis 720. ' +
          'Testtage: ganze Zahl von 1 bis 30. ' +
          'Bitte eine Testauswahl treffen.',
      ),
    );
    expect(ctx.admin.setting('roundTestDays')).toBeUndefined();
  });

  it('is a row of the universe settings when live, checked there with the same wording', () => {
    const specs = liveSpecs([HOURS, CHOICE]);
    expect(specs).toEqual([
      {
        key: 'roundTestHours',
        label: 'Testdauer (Stunden)',
        min: 1,
        max: 720,
        def: 24,
      },
    ]);
    const errors = universeErrors(
      { roundTestHours: 721 },
      { g: 1, s: 1, p: 1 },
      specs,
    );
    expect(errors.map((e) => rangeError(e.spec))).toEqual([
      'Testdauer (Stunden): ganze Zahl von 1 bis 720.',
    ]);
    expect(
      universeErrors({ roundTestHours: 5 }, { g: 1, s: 1, p: 1 }, specs),
    ).toEqual([]);
  });

  it('carries the mark of a live entry to its row (#441, 235b)', () => {
    expect(liveSpecs([{ ...HOURS, mark: 'classic' } as RoundSetting])).toEqual([
      expect.objectContaining({ key: 'roundTestHours', mark: 'classic' }),
    ]);
    expect(liveSpecs([HOURS])[0]).not.toHaveProperty('mark');
  });

  it('only a number is a row of the universe settings, never a switch', () => {
    // Stored data or a later entry may carry `live` on a switch by mistake.
    const flagged = {
      kind: 'switch',
      key: 'roundTestSwitch',
      name: 'testSwitch',
      label: 'Testschalter',
      order: 80,
      def: true,
      refusal: 'Bitte den Testschalter setzen.',
      live: true,
    } as unknown as RoundSetting;
    expect(liveSpecs([flagged, HOURS])).toEqual([
      expect.objectContaining({ key: 'roundTestHours' }),
    ]);
  });

  it('a value changed in the universe settings is the value of the round (X1)', () => {
    const ctx = testCtx();
    ctx.admin.putSettings([['roundTestHours', 72]]);
    expect(valuesOf(ctx)).toMatchObject({ testHours: 72 });
  });

  it('a new round refuses the first wrong setting of the registry, in the order of its numbers (owner, 2026-11-17)', () => {
    const ctx = testCtx();
    const wrong = wrongData(ROUND_SETTINGS);
    for (const s of ROUND_SETTINGS) {
      const key = s.group?.name ?? s.name;
      if (!(key in wrong)) continue;
      const refused = ROUND_SETTINGS.filter(
        (x) => (x.group?.name ?? x.name) === key,
      );
      expect(() => startRoundRules(ctx, wrong)).toThrow(
        new Error(wording(refused)),
      );
      delete wrong[key];
    }
    expect(roundRules(ctx).number).toBe(1);
  });
});
