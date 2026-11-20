// The Schnellwahl of the fleet form on the server (#292; owner, 2026-11-17):
// the main planet of each friend and of each guild member, and the last
// hostile targets, kept per player in their own table.
import { describe, expect, it } from 'vitest';
import type { Levels } from '../../core/types.ts';
import { type TestCtx, addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';
import { send } from './fleet-actions.ts';
import { quickState } from './quick-targets.ts';
import { roundRules } from './round.ts';
import { stateFor } from './state.ts';

/** Anna and friends: every planet at its own place, enough points for no noob protection. */
function world() {
  const ctx = testCtx();
  const anna = addUser(ctx, 'Anna', { research: { spy: 1, computer: 8 } });
  const names = ['Bert', 'Cora', 'Dora', 'Emil', 'Fritz', 'Gero', 'Hugo'];
  names.forEach((name) => addUser(ctx, name));
  addPlanet(ctx, anna.id, {
    g: 1,
    s: 1,
    p: 5,
    ships: { lf: 20, probe: 10, sc: 5 },
    res: { m: 50000, c: 40000, d: 30000 },
  });
  names.forEach((name, i) =>
    addPlanet(ctx, `u_${name}`, { g: 1, s: 2 + i, p: 6, b: { metal: 40 } }),
  );
  return { ctx, anna };
}

const ids = (ctx: TestCtx) =>
  quickState(ctx, ctx.players.get('u_Anna')!, roundRules(ctx));
const go = (mission: string, s: number, ships: Levels = { lf: 1 }) => ({
  mission,
  ships,
  to: { g: 1, s, p: 6 },
  pct: 10,
  cargo: {},
});
const friends = (ctx: TestCtx, ...names: string[]) =>
  names.forEach((n) => {
    ctx.friends.request('u_Anna', `u_${n}`);
    ctx.friends.accept('u_Anna', `u_${n}`);
  });
const guild = (ctx: TestCtx, ...names: string[]) => {
  ctx.guilds.create('g1', 'GLD', 'Gilde', '', 'u_Anna');
  for (const n of names) {
    ctx.guilds.apply(`u_${n}`, 'g1');
    ctx.guilds.accept(`u_${n}`);
  }
};

describe('friends and guild members', () => {
  it('lists the main planet of each friend, by name, and of nobody else', () => {
    const { ctx } = world();
    friends(ctx, 'Dora', 'Bert');
    // A request that is not answered is no friend.
    ctx.friends.request('u_Anna', 'u_Cora');
    expect(ids(ctx).friends).toEqual(['p1_2_6', 'p1_4_6']);
    expect(ids(ctx).guild).toEqual([]);
  });

  it('takes the chosen main planet of a player, not the first one', () => {
    const { ctx } = world();
    friends(ctx, 'Bert');
    addPlanet(ctx, 'u_Bert', { g: 2, s: 9, p: 4 });
    const bert = ctx.players.get('u_Bert')!;
    ctx.players.save({ ...bert, mainPlanet: 'p2_9_4' });
    expect(ids(ctx).friends).toEqual(['p2_9_4']);
  });

  it('lists the other members of the own guild, by name, and no applicant', () => {
    const { ctx } = world();
    guild(ctx, 'Cora', 'Bert');
    ctx.guilds.apply('u_Dora', 'g1');
    expect(ids(ctx).guild).toEqual(['p1_2_6', 'p1_3_6']);
    // Bert sees Anna and Cora, not himself.
    const bert = quickState(ctx, ctx.players.get('u_Bert')!, roundRules(ctx));
    expect(bert.guild).toEqual(['p1_1_5', 'p1_3_6']);
  });

  it('lists a player who is a friend and a guild member once, as a friend', () => {
    const { ctx } = world();
    friends(ctx, 'Bert');
    guild(ctx, 'Bert', 'Cora');
    expect(ids(ctx)).toMatchObject({
      friends: ['p1_2_6'],
      guild: ['p1_3_6'],
    });
  });

  it('has no guild entries while guilds are off in the round, and keeps the friends', () => {
    const { ctx } = world();
    friends(ctx, 'Bert');
    guild(ctx, 'Cora');
    ctx.admin.putSettings([['roundGuilds', 0]]);
    expect(ids(ctx)).toMatchObject({ friends: ['p1_2_6'], guild: [] });
  });

  it('keeps a player in vacation mode listed as a friend or guild member', () => {
    const { ctx } = world();
    friends(ctx, 'Bert');
    guild(ctx, 'Cora');
    for (const n of ['Bert', 'Cora'])
      ctx.players.save({ ...ctx.players.get(`u_${n}`)!, vacation: 1 });
    expect(ids(ctx)).toMatchObject({
      friends: ['p1_2_6'],
      guild: ['p1_3_6'],
    });
  });

  it('leaves out a player without a planet', () => {
    const { ctx } = world();
    friends(ctx, 'Bert');
    ctx.planets.delete('p1_2_6');
    expect(ids(ctx).friends).toEqual([]);
  });
});

describe('the last hostile targets', () => {
  it('remembers a Sturmangriff and an Auspex-Erkundung, not a transport', () => {
    const { ctx, anna } = world();
    send(ctx, anna, go('attack', 2));
    ctx.clock.t += 10;
    send(ctx, anna, go('spy', 3, { probe: 1 }));
    ctx.clock.t += 10;
    send(ctx, anna, go('transport', 4, { sc: 1 }));
    expect(ids(ctx).last).toEqual(['p1_3_6', 'p1_2_6']);
    expect(ctx.targets.of('u_Anna')).toEqual([
      { place: 'p1_3_6', owner: 'u_Cora', at: 1_000_010 },
      { place: 'p1_2_6', owner: 'u_Bert', at: 1_000_000 },
    ]);
  });

  it('lists the five newest different targets, newest first, one entry per place', () => {
    const { ctx, anna } = world();
    for (const s of [2, 3, 4, 5, 6, 7, 3]) {
      send(ctx, anna, go('attack', s));
      ctx.clock.t += 10;
    }
    expect(ids(ctx).last).toEqual([
      'p1_3_6',
      'p1_7_6',
      'p1_6_6',
      'p1_5_6',
      'p1_4_6',
    ]);
  });

  it('leaves a target out that no longer exists or has a new owner, and fills up with the next older ones', () => {
    const { ctx, anna } = world();
    for (const s of [2, 3, 4, 5, 6, 7]) {
      send(ctx, anna, go('attack', s));
      ctx.clock.t += 10;
    }
    expect(ids(ctx).last).toHaveLength(5);
    // The newest is gone, the second has a new owner: the oldest two come in.
    ctx.planets.delete('p1_7_6');
    ctx.planets.save({ ...ctx.planets.get('p1_6_6')!, owner: 'u_Hugo' });
    expect(ids(ctx).last).toEqual(['p1_5_6', 'p1_4_6', 'p1_3_6', 'p1_2_6']);
  });

  it('never lists an own planet, also one that was a foreign target once', () => {
    const { ctx, anna } = world();
    send(ctx, anna, go('attack', 2));
    ctx.planets.save({ ...ctx.planets.get('p1_2_6')!, owner: anna.id });
    expect(ids(ctx).last).toEqual([]);
  });

  it('leaves the places of a player in vacation mode out, and lists them again after it', () => {
    const { ctx, anna } = world();
    send(ctx, anna, go('attack', 2));
    ctx.clock.t += 10;
    send(ctx, anna, go('attack', 3));
    const bert = ctx.players.get('u_Bert')!;
    ctx.players.save({ ...bert, vacation: 1 });
    expect(ids(ctx).last).toEqual(['p1_3_6']);
    ctx.players.save({ ...bert, vacation: null });
    expect(ids(ctx).last).toEqual(['p1_3_6', 'p1_2_6']);
  });

  it('keeps the targets of every player apart, across all their planets', () => {
    const { ctx, anna } = world();
    addPlanet(ctx, anna.id, {
      g: 2,
      s: 5,
      p: 5,
      ships: { lf: 5 },
      res: { m: 5000, c: 5000, d: 5000 },
    });
    send(ctx, anna, go('attack', 2));
    ctx.clock.t += 10;
    send(ctx, anna, {
      ...go('attack', 3),
      planet: 'p2_5_5',
      to: { g: 1, s: 3, p: 6 },
    });
    expect(ids(ctx).last).toEqual(['p1_3_6', 'p1_2_6']);
    const bert = quickState(ctx, ctx.players.get('u_Bert')!, roundRules(ctx));
    expect(bert.last).toEqual([]);
  });

  it('is deleted with a new round', () => {
    const { ctx, anna } = world();
    const boss = addUser(ctx, 'Admin', { admin: true });
    addPlanet(ctx, boss.id, { g: 2, s: 2, p: 2 });
    send(ctx, anna, go('attack', 2));
    runAction(ctx, boss.id, { type: 'reset' });
    expect(ctx.targets.of('u_Anna')).toEqual([]);
  });
});

describe('the state', () => {
  it('carries the three lists under the key quick, after the admin part', () => {
    const { ctx, anna } = world();
    friends(ctx, 'Bert');
    send(ctx, anna, go('attack', 3));
    const state = stateFor(ctx, ctx.players.get(anna.id)!);
    expect(state.quick).toEqual({
      friends: ['p1_2_6'],
      guild: [],
      last: ['p1_3_6'],
    });
    // Right after the admin part; the keys of later features (the attack
    // union, #225) come behind it.
    const keys = Object.keys(state);
    expect(keys.indexOf('quick')).toBe(keys.indexOf('admin') + 1);
  });
});
