// Landnahme (#116): only with a Kolonistenarche; it founds a colony.
import { describe, expect, it } from 'vitest';
import type { Fleet, Levels } from '../../../core/types.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
} from '../../../server/test-helpers.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

const fleet = (ships: Levels) => ({ owner: 'a', from: 'p1', ships });

function setup(ships: Levels) {
  const ctx = testCtx();
  addUser(ctx, 'Anna');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: 'p1_4_8',
    toC: { g: 1, s: 4, p: 8 },
    mission: 'colonize',
    ships,
    cargo: { m: 500, c: 300, d: 100 },
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 4,
  };
  ctx.fleets.save(f);
  return { ctx, f };
}

describe('colonize', () => {
  it('has the data of today: its place, target, cargo, return and reports', () => {
    expect(rules).toMatchObject({
      order: 40,
      target: 'free',
      cargo: true,
      returns: true,
      visible: false,
      silent: false,
    });
  });

  it('needs a Kolonistenarche', () => {
    expect(canSend(fleet({ colony: 1 }))).toBeUndefined();
    expect(canSend(fleet({ colony: 2, sc: 1 }))).toBeUndefined();
    expect(canSend(fleet({ sc: 1 }))).toBe('noColonyShip');
    expect(canSend(fleet({ colony: 0, sc: 1 }))).toBe('noColonyShip');
  });

  it('founds a colony with the cargo; the last ark ends the fleet', () => {
    const { ctx, f } = setup({ colony: 1 });
    onArrive(ctx, f);
    expect(ctx.planets.get('p1_4_8')).toMatchObject({
      owner: 'u_Anna',
      name: 'Kolonie',
      created: f.arr,
    });
    expect(ctx.planets.get('p1_4_8')!.res).toMatchObject({
      m: 500,
      c: 300,
      d: 100,
    });
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.reports.ofPlayer('u_Anna')).toMatchObject([
      {
        time: f.arr,
        title: 'Kolonie gegründet [1:4:8]',
        text: 'Deine Kolonistenarche hat eine neue Kolonie gegründet.',
      },
    ]);
  });

  it('sends the other ships back empty, one ark fewer', () => {
    const { ctx, f } = setup({ colony: 2, sc: 1 });
    onArrive(ctx, f);
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      ships: { colony: 1, sc: 1 },
      cargo: { m: 0, c: 0, d: 0 },
    });
    const { ctx: c2, f: f2 } = setup({ colony: 1, lc: 4 });
    onArrive(c2, f2);
    expect(c2.fleets.get('f1')!.ships).toEqual({ lc: 4 });
  });

  it('pushes the founding as an own fleet (#192)', () => {
    const { ctx, f } = setup({ colony: 1 });
    subscribePush(ctx, 'u_Anna');
    onArrive(ctx, f);
    expect(queuedPushes(ctx)).toEqual([
      { user: 'u_Anna', kind: 'messages', topic: 'fleet' },
    ]);
  });
});
