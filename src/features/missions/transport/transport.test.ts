// Versorgungsflug (#116): no check of its own; it unloads at the target.
import { describe, expect, it } from 'vitest';
import type { Fleet } from '../../../core/types.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import { onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

function setup(targetOwner: 'u_Anna' | 'u_Bert') {
  const ctx = testCtx();
  addUser(ctx, 'Anna');
  addUser(ctx, 'Bert');
  addPlanet(ctx, 'u_Anna', { g: 1, s: 1, p: 5 });
  const t = addPlanet(ctx, targetOwner, {
    g: 1,
    s: 2,
    p: 6,
    name: 'Beta',
    res: { m: 10, c: 20, d: 30 },
  });
  const f: Fleet = {
    id: 'f1',
    owner: 'u_Anna',
    from: 'p1_1_5',
    fromC: { g: 1, s: 1, p: 5 },
    to: t.id,
    toC: { g: 1, s: 2, p: 6 },
    mission: 'transport',
    ships: { sc: 2 },
    cargo: { m: 100, c: 200, d: 300 },
    dep: ctx.now() - 10,
    arr: ctx.now(),
    ret: ctx.now() + 10,
    state: 'out',
    recalled: false,
    fuel: 4,
  };
  ctx.fleets.save(f);
  const att = { name: 'Anna', research: {}, rq: null };
  return { ctx, f, t, at: { t, att, def: att } };
}

describe('transport', () => {
  it('has the data of today: its place, target, cargo, return and reports', () => {
    expect(rules).toMatchObject({
      order: 20,
      target: 'any',
      cargo: true,
      returns: true,
      visible: false,
      silent: false,
    });
  });

  it('sends any ships', () => {
    expect(canSend()).toBeUndefined();
  });

  it('unloads at a foreign planet, reports to both, flies back empty', () => {
    const { ctx, f, at } = setup('u_Bert');
    onArrive(ctx, f, at);
    expect(ctx.planets.get('p1_2_6')!.res).toEqual({ m: 110, c: 220, d: 330 });
    expect(ctx.fleets.get('f1')).toMatchObject({
      state: 'back',
      cargo: { m: 0, c: 0, d: 0 },
    });
    const text =
      'Eine Flotte von Anna erreicht Beta [1:2:6] und liefert Adamant 100 · Psikristall 200 · Promethium 300.';
    expect(ctx.reports.ofPlayer('u_Anna')).toMatchObject([
      { title: 'Transport erreicht [1:2:6]', text, time: f.arr },
    ]);
    expect(ctx.reports.ofPlayer('u_Bert')).toMatchObject([
      { title: 'Lieferung von Anna', text },
    ]);
  });

  it('reports once at an own planet', () => {
    const { ctx, f, at } = setup('u_Anna');
    onArrive(ctx, f, at);
    expect(ctx.reports.ofPlayer('u_Anna')).toHaveLength(1);
  });
});
