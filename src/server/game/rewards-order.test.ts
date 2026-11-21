import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import type { Ctx } from './context.ts';
import { runAction } from './dispatch.ts';

// The refusals of `claimAchievement` and `claimDailyReward` and the order
// of their checks (#214), pinned before their checks move into src/core.

/** The message an action is refused with, or its answer. */
function answer(ctx: Ctx, uid: string, action: object): string {
  try {
    return String(runAction(ctx, uid, action as never));
  } catch (e) {
    return `error: ${(e as Error).message}`;
  }
}

function setup(rewards: { achievements?: boolean; daily?: boolean } = {}) {
  const ctx = testCtx();
  ctx.admin.putSettings([
    ['roundAchievements', rewards.achievements === false ? 0 : 1],
    ['roundDaily', rewards.daily === false ? 0 : 1],
  ]);
  const withPlanet = addUser(ctx, 'Anna');
  addPlanet(ctx, withPlanet.id, { b: { metal: 1 } });
  const without = addUser(ctx, 'Bert');
  return { ctx, anna: withPlanet.id, bert: without.id };
}

const claim = (id: unknown) => ({ type: 'claimAchievement', id });
const daily = { type: 'claimDailyReward' };

describe('claimAchievement', () => {
  it('refuses in a round without achievements before every other check', () => {
    const { ctx, anna, bert } = setup({ achievements: false });
    const off = 'error: Achievements sind in dieser Runde deaktiviert.';
    for (const id of ['buildings:metal:1', 'buildings:metal:2', 'unknown'])
      for (const uid of [anna, bert])
        expect(answer(ctx, uid, claim(id))).toBe(off);
  });

  it('then refuses an unknown id, before the planet', () => {
    const { ctx, anna, bert } = setup({ daily: false });
    const unknown = 'error: Unbekanntes Achievement.';
    for (const id of [
      'unknown',
      '',
      undefined,
      'buildings:metal:1 ',
      'BUILDINGS:METAL:1',
    ])
      for (const uid of [anna, bert])
        expect(answer(ctx, uid, claim(id))).toBe(unknown);
  });

  it('then refuses without a planet, before the progress', () => {
    const { ctx, bert } = setup();
    for (const id of ['buildings:metal:1', 'buildings:metal:2'])
      expect(answer(ctx, bert, claim(id))).toBe(
        'error: Du brauchst einen Planeten.',
      );
  });

  it('then refuses a goal not reached, and a claim the second time', () => {
    const { ctx, anna } = setup();
    expect(answer(ctx, anna, claim('buildings:metal:2'))).toBe(
      'error: Dieses Achievement ist noch offen.',
    );
    expect(answer(ctx, anna, claim('buildings:metal:1'))).toBe(
      'Achievement-Belohnung abgeholt.',
    );
    expect(answer(ctx, anna, claim('buildings:metal:1'))).toBe(
      'error: Diese Belohnung wurde schon abgeholt.',
    );
  });

  it('takes the goal exactly at its target', () => {
    const { ctx, anna } = setup();
    const home = ctx.planets.home(anna)!;
    ctx.planets.save({ ...home, b: { ...home.b, metal: 3 } });
    expect(answer(ctx, anna, claim('buildings:metal:3'))).toBe(
      'Achievement-Belohnung abgeholt.',
    );
    expect(answer(ctx, anna, claim('buildings:metal:5'))).toBe(
      'error: Dieses Achievement ist noch offen.',
    );
  });
});

describe('claimDailyReward', () => {
  it('refuses in a round without daily rewards before the planet', () => {
    const { ctx, anna, bert } = setup({ daily: false });
    for (const uid of [anna, bert])
      expect(answer(ctx, uid, daily)).toBe(
        'error: Tagesbelohnungen sind in dieser Runde deaktiviert.',
      );
  });

  it('then refuses without a planet, then once a day', () => {
    const { ctx, anna, bert } = setup({ achievements: false });
    expect(answer(ctx, bert, daily)).toBe('error: Du brauchst einen Planeten.');
    expect(answer(ctx, anna, daily)).toBe('Tägliche Belohnung abgeholt.');
    expect(answer(ctx, anna, daily)).toBe(
      'error: Die heutige Belohnung wurde schon abgeholt.',
    );
  });
});
