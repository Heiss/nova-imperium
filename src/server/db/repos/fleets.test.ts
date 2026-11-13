import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../../core/types.ts';
import { addUser, testCtx } from '../../test-helpers.ts';

const base = {
  owner: 'u_Anna',
  from: 'a',
  fromC: { g: 1, s: 2, p: 3 },
  to: 'b',
  toC: { g: 4, s: 5, p: 6 },
  mission: 'attack' as const,
  ships: { lf: 3 },
  cargo: { m: 1, c: 2, d: 3 },
  dep: 0,
  recalled: false,
  fuel: 41,
};

const fleet = (over: Partial<Fleet> & Pick<Fleet, 'id'>): Fleet => ({
  ...base,
  arr: 50,
  ret: 100,
  state: 'out',
  ...over,
});

describe('fleets repository', () => {
  it('saves and reads a fleet with its ships and cargo', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const f = fleet({ id: 'f1', ships: { lf: 3, sc: 0, hf: 1 } });
    ctx.fleets.save(f);
    expect(ctx.fleets.get('f1')).toEqual({ ...f, ships: { lf: 3, hf: 1 } });
    expect(ctx.fleets.get('none')).toBeNull();
  });

  it('updates only the state, cargo, return, recall and ships', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.fleets.save(fleet({ id: 'f1' }));
    const next = fleet({
      id: 'f1',
      state: 'back',
      recalled: true,
      ret: 77,
      cargo: { m: 9, c: 8, d: 7 },
      ships: { lf: 1 },
      arr: 999,
      fuel: 1,
    });
    ctx.fleets.save(next);
    expect(ctx.fleets.get('f1')).toEqual({ ...next, arr: 50, fuel: 41 });
    expect(ctx.db.prepare('SELECT recalled FROM fleets').pluck().get()).toBe(1);
  });

  it('finds the due fleets in time order and counts them per player', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    ctx.fleets.save(fleet({ id: 'f1', arr: 50, ret: 100, dep: 2 }));
    ctx.fleets.save(
      fleet({ id: 'f2', arr: 10, ret: 40, state: 'back', dep: 1 }),
    );
    ctx.fleets.save(fleet({ id: 'f3', arr: 70, ret: 140, dep: 1 }));
    ctx.fleets.save(fleet({ id: 'f0', arr: 40, ret: 50, owner: 'u_Bert' }));
    expect(ctx.fleets.due(60).map((f) => f.id)).toEqual(['f0', 'f2', 'f1']);
    expect(ctx.fleets.due(39).map((f) => f.id)).toEqual([]);
    expect(ctx.fleets.due(40).map((f) => f.id)).toEqual(['f0', 'f2']);
    expect(ctx.fleets.count('u_Anna')).toBe(3);
    expect(ctx.fleets.count('u_Bert')).toBe(1);
    expect(ctx.fleets.count('nobody')).toBe(0);
    expect(ctx.fleets.all().map((f) => f.id)).toEqual(['f0', 'f2', 'f3', 'f1']);
  });

  it('deletes one fleet or all', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.fleets.save(fleet({ id: 'f1' }));
    ctx.fleets.save(fleet({ id: 'f2' }));
    ctx.fleets.delete('f1');
    expect(ctx.fleets.all().map((f) => f.id)).toEqual(['f2']);
    ctx.fleets.deleteAll();
    expect(ctx.fleets.all()).toEqual([]);
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM fleet_ships').pluck().get(),
    ).toBe(0);
  });
});
