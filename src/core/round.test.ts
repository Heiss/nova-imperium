// The choices of a new round (#214): both reward options and the guild
// switch are yes or no; an option not sent keeps the current one.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { roundChoice, roundError } from './round.ts';

const current = { achievements: true, daily: false, guilds: true };
const both = { achievements: false, daily: true };

describe('the check of a new round', () => {
  it('takes yes or no for every option', () => {
    for (const achievements of [true, false])
      for (const daily of [true, false])
        for (const guilds of [true, false]) {
          expect(roundError(current, { achievements, daily }, guilds)).toBe(
            null,
          );
          expect(roundChoice(current, { achievements, daily }, guilds)).toEqual(
            { achievements, daily, guilds },
          );
        }
  });

  it('keeps the current options that are not sent', () => {
    expect(roundError(current, undefined, undefined)).toBeNull();
    expect(roundChoice(current, undefined, undefined)).toEqual(current);
    expect(roundChoice(current, both, undefined)).toEqual({
      ...both,
      guilds: true,
    });
    expect(roundChoice(current, undefined, false)).toEqual({
      achievements: true,
      daily: false,
      guilds: false,
    });
  });

  it('refuses reward options that are not both yes or no', () => {
    for (const rewards of [
      null,
      {},
      { achievements: true },
      { daily: true },
      { achievements: 'true', daily: true },
      { achievements: true, daily: 1 },
      5,
      'yes',
    ])
      expect(roundError(current, rewards, true)).toBe('rewards');
  });

  it('refuses a guild switch that is not yes or no', () => {
    for (const guilds of ['false', 0, null, {}])
      expect(roundError(current, both, guilds)).toBe('guilds');
  });

  it('names the reward options first, then the guild switch', () => {
    expect(roundError(current, { achievements: true }, 'no')).toBe('rewards');
    expect(roundError(current, undefined, 'no')).toBe('guilds');
  });

  it('refuses exactly what is not yes or no (property)', () => {
    const value = fc.oneof(fc.boolean(), fc.constant(undefined), fc.anything());
    fc.assert(
      fc.property(value, value, value, (achievements, daily, guilds) => {
        const rewards = { achievements, daily };
        const error =
          typeof achievements !== 'boolean' || typeof daily !== 'boolean'
            ? 'rewards'
            : guilds === undefined || typeof guilds === 'boolean'
              ? null
              : 'guilds';
        expect(roundError(current, rewards, guilds)).toBe(error);
      }),
    );
  });
});
