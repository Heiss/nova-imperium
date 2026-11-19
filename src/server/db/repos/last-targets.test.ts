import { describe, expect, it } from 'vitest';
import { addUser, testCtx } from '../../test-helpers.ts';
import { KEPT_TARGETS } from './last-targets.ts';

// The last hostile targets of a player (#292): one row per player and place.
function two() {
  const ctx = testCtx();
  for (const name of ['Anna', 'Bert']) addUser(ctx, name);
  return ctx;
}

describe('last targets repository', () => {
  it('lists the targets of a player, newest first, and nobody else`s', () => {
    const ctx = two();
    ctx.targets.record('u_Anna', { place: 'p1_1_1', owner: 'u_Bert', at: 1 });
    ctx.targets.record('u_Anna', { place: 'p1_1_2', owner: 'u_Bert', at: 3 });
    ctx.targets.record('u_Anna', { place: 'p1_1_3', owner: 'u_Bert', at: 2 });
    expect(ctx.targets.of('u_Anna').map((t) => t.place)).toEqual([
      'p1_1_2',
      'p1_1_3',
      'p1_1_1',
    ]);
    expect(ctx.targets.of('u_Bert')).toEqual([]);
    ctx.db.close();
  });

  it('keeps one row per place: aiming again moves it to the front with the owner of that moment', () => {
    const ctx = two();
    ctx.targets.record('u_Anna', { place: 'p1_1_1', owner: 'u_Bert', at: 1 });
    ctx.targets.record('u_Anna', { place: 'p1_1_2', owner: 'u_Bert', at: 2 });
    ctx.targets.record('u_Anna', { place: 'p1_1_1', owner: 'u_Anna', at: 3 });
    expect(ctx.targets.of('u_Anna')).toEqual([
      { place: 'p1_1_1', owner: 'u_Anna', at: 3 },
      { place: 'p1_1_2', owner: 'u_Bert', at: 2 },
    ]);
    ctx.db.close();
  });

  it('keeps the newest ones only, per player', () => {
    const ctx = two();
    for (let i = 1; i <= KEPT_TARGETS + 3; i++)
      ctx.targets.record('u_Anna', {
        place: `p1_1_${i}`,
        owner: 'u_Bert',
        at: i,
      });
    ctx.targets.record('u_Bert', { place: 'p1_9_9', owner: 'u_Anna', at: 1 });
    const kept = ctx.targets.of('u_Anna');
    expect(kept).toHaveLength(KEPT_TARGETS);
    expect(kept[0]!.at).toBe(KEPT_TARGETS + 3);
    expect(kept.at(-1)!.at).toBe(4);
    expect(ctx.targets.of('u_Bert')).toHaveLength(1);
    ctx.db.close();
  });

  it('deletes everything, and the rows of a deleted player go with the player', () => {
    const ctx = two();
    ctx.targets.record('u_Anna', { place: 'p1_1_1', owner: 'u_Bert', at: 1 });
    ctx.targets.record('u_Bert', { place: 'p1_1_2', owner: 'u_Anna', at: 1 });
    ctx.db.prepare("DELETE FROM users WHERE id = 'u_Anna'").run();
    expect(ctx.targets.of('u_Anna')).toEqual([]);
    expect(ctx.targets.of('u_Bert')).toHaveLength(1);
    ctx.targets.deleteAll();
    expect(ctx.targets.of('u_Bert')).toEqual([]);
    ctx.db.close();
  });
});
