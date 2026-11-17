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
import {
  liveSpecs,
  UNIVERSE_SPECS,
  universeErrors,
} from '../../core/universe.ts';
import { testCtx } from '../test-helpers.ts';
import { rangeError, roundRules, startRoundRules } from './round.ts';

/** A new feature's entry: whole hours from 1 to 720, 24 by default, live. */
const HOURS: RoundNumber<'testHours'> = {
  kind: 'number',
  key: 'roundTestHours',
  name: 'testHours',
  label: 'Testdauer (Stunden)',
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
    expect(valuesOf(ctx)).toMatchObject({
      number: 3,
      testHours: 48,
      testChoice: 1,
      mainLock: 7,
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
    expect(() =>
      startRoundRules(ctx, { mainLock: 0, testHours: 0 }, settings),
    ).toThrow(
      'Bitte für die Sperre des Hauptplaneten 1 bis 30 ganze Tage angeben.',
    );
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
    const specs = liveSpecs(settings);
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

  it('a value changed in the universe settings is the value of the round (X1)', () => {
    const ctx = testCtx();
    ctx.admin.putSettings([['roundTestHours', 72]]);
    expect(valuesOf(ctx)).toMatchObject({ testHours: 72 });
  });

  it('the settings of main are not live: the universe settings stay as they were', () => {
    expect(liveSpecs()).toEqual([]);
    expect(UNIVERSE_SPECS.some((s) => s.key.startsWith('round'))).toBe(false);
  });
});
