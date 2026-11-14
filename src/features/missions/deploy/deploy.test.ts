// Verlegung (#116, #129): no check of its own; the fleet stays at the target.
import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

describe('deploy', () => {
  it('has the data of today: its place, target, cargo, return and reports', () => {
    expect(rules).toMatchObject({
      order: 50,
      target: 'own',
      cargo: true,
      returns: false,
      visible: false,
      silent: false,
    });
  });

  it('sends any ships', () => {
    expect(canSend()).toBeUndefined();
  });

  it('lands ships, cargo and half the fuel, and the fleet ends', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
    const t = addPlanet(ctx, 'u_Anna', {
      g: 1,
      s: 1,
      p: 7,
      name: 'Kolonie',
      ships: { sc: 1 },
      res: { m: 1, c: 2, d: 3 },
    });
    const f: Fleet = {
      id: 'f1',
      owner: 'u_Anna',
      from: 'p1_1_5',
      fromC: { g: 1, s: 1, p: 5 },
      to: t.id,
      toC: { g: 1, s: 1, p: 7 },
      mission: 'deploy',
      ships: { sc: 2, lf: 3 },
      cargo: { m: 10, c: 20, d: 30 },
      dep: ctx.now() - 10,
      arr: ctx.now(),
      ret: ctx.now() + 10,
      state: 'out',
      recalled: false,
      fuel: 41,
    };
    ctx.fleets.save(f);
    const anna = { name: 'Anna', research: {}, rq: null };
    onArrive(ctx, f, { t, att: anna, def: anna });
    expect(ctx.planets.get(t.id)).toMatchObject({
      ships: { sc: 3, lf: 3 },
      res: { m: 11, c: 22, d: 53 },
    });
    expect(ctx.fleets.get('f1')).toBeNull();
    expect(ctx.reports.ofPlayer('u_Anna')).toMatchObject([
      {
        time: f.arr,
        title: 'Verlegung erreicht [1:1:7]',
        text: 'Deine Flotte bleibt auf Kolonie [1:1:7] und liefert Adamant 10 · Psikristall 20 · Promethium 50, davon 20 übriger Treibstoff.',
      },
    ]);
  });
});
