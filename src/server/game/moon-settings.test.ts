// The moon settings of the round (#433, owner, 2026-11-27): the cap from 1
// to 100 (208a) and the resources per percent from 10,000 to 1,000,000 in
// steps of 10,000 (212a, 218a), in „Neue Runde“ and live in the universe
// settings.
import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { roundRules } from './round.ts';

const STEP =
  'Rohstoffe je 1 % Mondchance: ganze Zahl von 10.000 bis 1.000.000 in Schritten von 10.000.';
const CAP = 'Mondchance höchstens (%): ganze Zahl von 1 bis 100.';

function world() {
  const ctx = testCtx(1_000_000);
  addUser(ctx, 'Anna', { admin: true });
  return ctx;
}

describe('the moon settings of the round (#433)', () => {
  it('are 20 and 100,000 by default', () => {
    expect(roundRules(world())).toMatchObject({
      moonChanceMax: 20,
      moonPerPercent: 100000,
    });
  });

  it('take a cap of 1 to 100 in a new round and refuse others', () => {
    const ctx = world();
    for (const moonChanceMax of [0, 101, 2.5, '50', null])
      expect(() =>
        runAction(ctx, 'u_Anna', { type: 'reset', moonChanceMax }),
      ).toThrow(CAP);
    expect(roundRules(ctx)).toMatchObject({ number: 1, moonChanceMax: 20 });
    for (const moonChanceMax of [1, 100]) {
      runAction(ctx, 'u_Anna', { type: 'reset', moonChanceMax });
      expect(roundRules(ctx).moonChanceMax).toBe(moonChanceMax);
    }
  });

  it('take the resources in steps of 10,000 from 10,000 to 1,000,000 in a new round', () => {
    const ctx = world();
    for (const moonPerPercent of [0, 9999, 15000, 1_010_000, 10000.5, null])
      expect(() =>
        runAction(ctx, 'u_Anna', { type: 'reset', moonPerPercent }),
      ).toThrow(STEP);
    expect(roundRules(ctx)).toMatchObject({
      number: 1,
      moonPerPercent: 100000,
    });
    for (const moonPerPercent of [10000, 20000, 1_000_000]) {
      runAction(ctx, 'u_Anna', { type: 'reset', moonPerPercent });
      expect(roundRules(ctx).moonPerPercent).toBe(moonPerPercent);
    }
  });

  it('are changed during the round in the universe settings, with the same checks', () => {
    const ctx = world();
    const settings = ctx.admin.universe();
    const save = (more: Record<string, unknown>) =>
      runAction(ctx, 'u_Anna', {
        type: 'settings',
        settings: { ...settings, ...more },
      });
    expect(() => save({ roundMoonPerPercent: 15000 })).toThrow(STEP);
    expect(() => save({ roundMoonChanceMax: 101 })).toThrow(CAP);
    expect(roundRules(ctx)).toMatchObject({
      moonChanceMax: 20,
      moonPerPercent: 100000,
    });
    save({ roundMoonChanceMax: 100, roundMoonPerPercent: 20000 });
    expect(roundRules(ctx)).toMatchObject({
      number: 1,
      moonChanceMax: 100,
      moonPerPercent: 20000,
    });
  });
});
