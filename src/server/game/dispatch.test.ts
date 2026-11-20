// The frame of every action (#326): the due fleets first, then the action.
import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { ACTIONS, runAction } from './dispatch.ts';

describe('runAction', () => {
  it('lets the fleets that are due arrive before the action runs', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5, ships: { lf: 1 } });
    ctx.fleets.save({
      id: 'f1',
      owner: 'u_Anna',
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: 'p1_1_5',
      toC: { g: 1, s: 1, p: 5 },
      mission: 'deploy',
      ships: { lf: 2 },
      cargo: { m: 0, c: 0, d: 0 },
      dep: ctx.now() - 20,
      arr: ctx.now() - 10,
      ret: ctx.now() + 10,
      state: 'back',
      recalled: false,
      fuel: 1,
    });
    // Its return is due: the ships are home when the action sees the planet.
    ctx.clock.t = ctx.now() + 10;
    runAction(ctx, 'u_Anna', { type: 'read' });
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.planets.get('p1_1_5')!.ships.lf).toBe(3);
  });

  it('counts an order of the shipyard for the achievements, one for each action', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna', { research: { comb: 1 } });
    addPlanet(ctx, 'u_Anna', {
      b: { yard: 1 },
      res: { m: 1e6, c: 1e6, d: 1e6 },
    });
    const progress = () =>
      ctx.db.prepare('SELECT metric, value FROM achievement_progress').all();
    expect(progress()).toEqual([]);
    runAction(ctx, 'u_Anna', { type: 'order', key: 'lf', n: 1 });
    runAction(ctx, 'u_Anna', { type: 'order', key: 'lf', n: 1 });
    expect(progress()).toEqual([{ metric: 'yard:order', value: 2 }]);
  });

  it('journals the refusal of a game rule but not a failure of the server, which goes on', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
    const events = () =>
      ctx.db.prepare('SELECT COUNT(*) FROM round_events').pluck().get();
    ACTIONS.broken = () => {
      throw new Error('disk full');
    };
    try {
      expect(() => runAction(ctx, 'u_Anna', { type: 'broken' })).toThrow(
        'disk full',
      );
    } finally {
      delete ACTIONS.broken;
    }
    expect(events()).toBe(0);
    expect(() =>
      runAction(ctx, 'u_Anna', { type: 'build', key: 'x' }),
    ).toThrow();
    expect(events()).toBeGreaterThan(0);
  });
});
