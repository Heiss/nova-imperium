// The settings of the round for the expeditions (#93; owner, 2026-11-19):
// extra places, hours per level and the universe speed on the stay, set in
// „Neue Runde“ and changed live in the admin panel (#283, #310, X1). The
// rules they feed are tested with the mission (src/features/missions/
// expedition/expedition.test.ts); this file tests the way they get into the
// round.
import { describe, expect, it } from 'vitest';
import {
  extraSlots,
  hoursPerLevel,
  stayDuration,
  staysByUniverseSpeed,
} from '../../core/expedition.ts';
import type { AuditEntry } from '../audit.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { universe } from './context.ts';
import { runAction } from './dispatch.ts';
import { roundRules } from './round.ts';

function world() {
  const ctx = testCtx();
  const admin = addUser(ctx, 'Admin', { admin: true });
  addPlanet(ctx, admin.id);
  return { ctx, admin };
}

const message = (run: () => unknown): string => {
  try {
    run();
  } catch (e) {
    return (e as Error).message;
  }
  return '';
};

describe('the settings of the expeditions in the round', () => {
  it('start with the classic rules in an existing universe: no extra place, an hour per level, real time', () => {
    const { ctx } = world();
    expect(roundRules(ctx)).toMatchObject({
      expeditionExtraSlots: 0,
      expeditionHours: 1,
      expeditionSpeed: 0,
    });
    const u = universe(ctx);
    expect(extraSlots(u)).toBe(0);
    expect(hoursPerLevel(u)).toBe(1);
    expect(staysByUniverseSpeed(u)).toBe(false);
    expect(stayDuration(2, u)).toBe(2 * 3_600_000);
  });

  it('are set in „Neue Runde“ as one group, the current ones without a choice', () => {
    const { ctx, admin } = world();
    const event = {} as AuditEntry;
    runAction(
      ctx,
      admin.id,
      {
        type: 'reset',
        expedition: {
          expeditionExtraSlots: 3,
          expeditionHours: 12,
          expeditionSpeed: 1,
        },
      },
      event,
    );
    expect(roundRules(ctx)).toMatchObject({
      expeditionExtraSlots: 3,
      expeditionHours: 12,
      expeditionSpeed: 1,
    });
    const u = universe(ctx);
    expect(u).toMatchObject({
      roundExpeditionExtraSlots: 3,
      roundExpeditionHours: 12,
      roundExpeditionSpeed: 1,
    });
    expect(staysByUniverseSpeed(u)).toBe(true);
    expect(event.detail).toMatchObject({
      before: {
        expeditionExtraSlots: 0,
        expeditionHours: 1,
        expeditionSpeed: 0,
      },
      after: {
        expeditionExtraSlots: 3,
        expeditionHours: 12,
        expeditionSpeed: 1,
      },
    });
    // A new round without the group keeps them.
    runAction(ctx, admin.id, { type: 'reset' });
    expect(roundRules(ctx)).toMatchObject({
      expeditionExtraSlots: 3,
      expeditionHours: 12,
      expeditionSpeed: 1,
    });
  });

  it('refuse values outside their range in „Neue Runde“ with the words of the universe settings, and keep the round', () => {
    const { ctx, admin } = world();
    const refused = (expedition: unknown): string =>
      message(() => runAction(ctx, admin.id, { type: 'reset', expedition }));
    const ok = {
      expeditionExtraSlots: 0,
      expeditionHours: 1,
      expeditionSpeed: 0,
    };
    expect(refused({ ...ok, expeditionExtraSlots: 11 })).toBe(
      'Zusätzliche Expeditionsplätze: ganze Zahl von 0 bis 10.',
    );
    expect(refused({ ...ok, expeditionExtraSlots: -1 })).toBe(
      'Zusätzliche Expeditionsplätze: ganze Zahl von 0 bis 10.',
    );
    expect(refused({ ...ok, expeditionHours: 0 })).toBe(
      'Haltezeit in Stunden je Stufe: ganze Zahl von 1 bis 24.',
    );
    expect(refused({ ...ok, expeditionHours: 25 })).toBe(
      'Haltezeit in Stunden je Stufe: ganze Zahl von 1 bis 24.',
    );
    expect(refused({ ...ok, expeditionSpeed: 2 })).toBe(
      'Haltezeit durch das Universums-Tempo teilen: ganze Zahl von 0 bis 1.',
    );
    expect(roundRules(ctx)).toMatchObject({ number: 1, ...ok });
  });

  it('change live in the admin panel, with the same ranges (X1)', () => {
    const { ctx, admin } = world();
    const settings = {
      ...universe(ctx),
      roundExpeditionExtraSlots: 10,
      roundExpeditionHours: 24,
      roundExpeditionSpeed: 1,
    };
    runAction(ctx, admin.id, { type: 'settings', settings });
    expect(roundRules(ctx)).toMatchObject({
      expeditionExtraSlots: 10,
      expeditionHours: 24,
      expeditionSpeed: 1,
    });
    // The speed of the universe divides the stay of the round now.
    const u = universe(ctx);
    expect(stayDuration(5, u)).toBe(Math.round((5 * 3_600_000) / u.speed));
    for (const bad of [
      { roundExpeditionExtraSlots: 11 },
      { roundExpeditionHours: 25 },
      { roundExpeditionSpeed: 2 },
    ])
      expect(
        message(() =>
          runAction(ctx, admin.id, {
            type: 'settings',
            settings: { ...settings, ...bad },
          }),
        ),
        JSON.stringify(bad),
      ).not.toBe('');
    expect(roundRules(ctx)).toMatchObject({ expeditionExtraSlots: 10 });
  });
});
