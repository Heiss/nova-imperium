// The frame of every action (#326): the due fleets first, then the action.
import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import { runAction } from './dispatch.ts';

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
});
