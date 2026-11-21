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

  it('keeps the main target of missiles and leaves them out of the slots asked (#54)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const missiles = fleet({
      id: 'f1',
      mission: 'missile',
      ships: { ipm: 4 },
      aim: 'gauss',
    });
    ctx.fleets.save(missiles);
    ctx.fleets.save(fleet({ id: 'f2', mission: 'missile', ships: { ipm: 1 } }));
    ctx.fleets.save(fleet({ id: 'f3' }));
    expect(ctx.fleets.get('f1')).toEqual(missiles);
    expect(ctx.fleets.get('f2')).not.toHaveProperty('aim');
    // The main target is written once, like the gift.
    ctx.fleets.save({ ...missiles, aim: 'rl', state: 'back' });
    expect(ctx.fleets.get('f1')).toMatchObject({ aim: 'gauss', state: 'back' });
    expect(ctx.fleets.count('u_Anna')).toBe(3);
    expect(ctx.fleets.count('u_Anna', [])).toBe(3);
    expect(ctx.fleets.count('u_Anna', ['missile'])).toBe(1);
    expect(ctx.fleets.count('u_Anna', ['missile', 'attack'])).toBe(0);
  });

  it('writes every extra column a fleet has at once: holding time, gift, main target and union', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const all = fleet({
      id: 'f1',
      mission: 'hold',
      hold: 3_600_000,
      gift: true,
      aim: 'gauss',
      union: 'f1',
    });
    ctx.fleets.save(all);
    expect(ctx.fleets.get('f1')).toEqual(all);
  });

  it('counts and reroutes without a list as with an empty one', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.fleets.save(fleet({ id: 'f1', mission: 'missile', ships: { ipm: 1 } }));
    ctx.fleets.save(fleet({ id: 'f2', to: 'gone' }));
    expect(ctx.fleets.count('u_Anna')).toBe(2);
    ctx.fleets.reroute('gone', 'moved');
    expect(ctx.fleets.get('f2')!.to).toBe('moved');
    ctx.fleets.reroute('b', 'moved', ['missile']);
    expect(ctx.fleets.get('f1')!.to).toBe('b');
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

  it('reroutes the fleets of a place that is gone (#95)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.fleets.save(fleet({ id: 'to', to: 'm1' }));
    ctx.fleets.save(fleet({ id: 'back', to: 'm1', state: 'back' }));
    ctx.fleets.save(fleet({ id: 'home', from: 'm1', to: 'x' }));
    ctx.fleets.save(fleet({ id: 'homeBack', from: 'm1', state: 'back' }));
    ctx.fleets.save(fleet({ id: 'other', from: 'q', to: 'r' }));
    ctx.fleets.reroute('m1', 'p1');
    const legs = Object.fromEntries(
      ctx.fleets.all().map((f) => [f.id, [f.from, f.to]]),
    );
    expect(legs).toEqual({
      to: ['a', 'p1'],
      back: ['a', 'm1'],
      home: ['p1', 'x'],
      homeBack: ['p1', 'b'],
      other: ['q', 'r'],
    });
    // Nothing else of a fleet changes.
    expect(ctx.fleets.get('to')).toEqual(fleet({ id: 'to', to: 'p1' }));
  });

  it('moves the fleets that hold at a place that is gone and keeps their time (#55, owner, 2026-11-19)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const hold = { mission: 'hold' as const, arr: 50, ret: 500, hold: 300 };
    ctx.fleets.save(fleet({ id: 'h1', to: 'm1', state: 'hold', ...hold }));
    ctx.fleets.save(fleet({ id: 'h2', to: 'p1', state: 'hold', ...hold }));
    ctx.fleets.save(fleet({ id: 'h3', to: 'x', state: 'hold', ...hold }));
    ctx.fleets.reroute('m1', 'p1');
    expect(ctx.fleets.get('h1')).toEqual(
      fleet({ id: 'h1', to: 'p1', state: 'hold', ...hold }),
    );
    expect(ctx.fleets.get('h2')!.to).toBe('p1');
    expect(ctx.fleets.get('h3')!.to).toBe('x');
    expect(ctx.fleets.get('h1')!.state).toBe('hold');
  });

  it('keeps the target of the missions it is told to keep, the missiles of #54', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.fleets.save(fleet({ id: 'ships', to: 'm1', mission: 'attack' }));
    ctx.fleets.save(fleet({ id: 'ipm', to: 'm1', mission: 'missile' }));
    ctx.fleets.save(fleet({ id: 'other', to: 'x', mission: 'missile' }));
    ctx.fleets.reroute('m1', 'p1', ['missile']);
    const targets = Object.fromEntries(
      ctx.fleets.all().map((f) => [f.id, f.to]),
    );
    expect(targets).toEqual({ ships: 'p1', ipm: 'm1', other: 'x' });
    // Without a list every flight is rerouted, as before.
    ctx.fleets.reroute('m1', 'p2');
    expect(ctx.fleets.get('ipm')!.to).toBe('p2');
  });

  it('keeps the holding time of a Halten and finds it due at the end of holding (#55)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const h = fleet({
      id: 'h1',
      mission: 'hold',
      arr: 50,
      ret: 500,
      hold: 300,
      state: 'hold',
    });
    ctx.fleets.save(h);
    expect(ctx.fleets.get('h1')).toEqual(h);
    // A Halten of 0 hours keeps its holding time; no other fleet has one.
    ctx.fleets.save({ ...h, id: 'h0', hold: 0, state: 'out' });
    expect(ctx.fleets.get('h0')).toMatchObject({ hold: 0 });
    ctx.fleets.save(fleet({ id: 'f1', arr: 60, ret: 900 }));
    expect(ctx.fleets.get('f1')).not.toHaveProperty('hold');
    expect(ctx.fleets.due(349).map((f) => f.id)).toEqual(['h0', 'f1']);
    expect(ctx.fleets.due(350).map((f) => f.id)).toEqual(['h0', 'f1', 'h1']);
    // The holding time is set at the launch and never changes.
    ctx.fleets.save({ ...h, hold: 1, state: 'back' });
    expect(ctx.fleets.get('h1')).toMatchObject({ hold: 300, state: 'back' });
  });

  it('lists the fleets flying to a place or holding there, not those on their way home (#55)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    ctx.fleets.save(fleet({ id: 'f2', to: 'p1', dep: 2 }));
    ctx.fleets.save(fleet({ id: 'f1', to: 'p1', dep: 1, state: 'back' }));
    ctx.fleets.save(
      fleet({
        id: 'f3',
        to: 'p1',
        dep: 1,
        mission: 'hold',
        state: 'hold',
        hold: 5,
      }),
    );
    ctx.fleets.save(fleet({ id: 'f4', to: 'p2', dep: 0 }));
    expect(ctx.fleets.at('p1').map((f) => f.id)).toEqual(['f3', 'f2']);
    expect(ctx.fleets.at('none')).toEqual([]);
  });
});
