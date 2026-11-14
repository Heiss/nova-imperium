import { describe, expect, it } from 'vitest';
import { placeId } from '../../../core/place.ts';
import { addPlanet, addUser, testCtx } from '../../test-helpers.ts';

describe('planets repository', () => {
  it('saves a planet with its buildings, units, shares and queues', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const p = addPlanet(ctx, 'u_Anna', {
      b: { metal: 3, lab: 1 },
      ships: { lf: 2, sc: 0 },
      def: { rl: 4, ll: 0 },
      pct: { metal: 50, solar: 100 },
      sq: [
        { key: 'lf', n: 2, unit: 1000.2 },
        { key: 'rl', n: 1, unit: 50 },
      ],
      sqT: 77,
      bq: { key: 'metal', lvl: 4, start: 1, end: 2, cost: [3, 4, 5] },
      res: { m: 1, c: 2, d: 3 },
      unlimited: true,
    });
    expect(ctx.planets.get(p.id)).toEqual({
      ...p,
      ships: { lf: 2 },
      def: { rl: 4 },
      sq: [{ ...p.sq[0], unit: 1001 }, p.sq[1]],
    });
    expect(
      ctx.db
        .prepare('SELECT kind, key, count FROM planet_units ORDER BY key')
        .all(),
    ).toEqual([
      { kind: 'ship', key: 'lf', count: 2 },
      { kind: 'defense', key: 'rl', count: 4 },
    ]);
    expect(ctx.planets.get('none')).toBeNull();
  });

  it('replaces the parts of a planet on save', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const p = addPlanet(ctx, 'u_Anna', {
      b: { metal: 3 },
      ships: { lf: 2 },
      def: { rl: 4 },
      pct: { metal: 50 },
      sq: [{ key: 'lf', n: 2, unit: 10 }],
      sqT: 5,
      bq: { key: 'metal', lvl: 4, start: 1, end: 2, cost: [3, 4, 5] },
    });
    const next = {
      ...p,
      name: 'Neu',
      b: { lab: 1 },
      ships: {},
      def: {},
      pct: {},
      sq: [],
      sqT: null,
      bq: null,
      unlimited: false,
    };
    ctx.planets.save(next);
    expect(ctx.planets.get(p.id)).toEqual(next);
    expect(
      ctx.db.prepare('SELECT unlimited, bq_key FROM planets').get(),
    ).toEqual({ unlimited: 0, bq_key: null });
  });

  it('finds the home planet, the planets of a player and all planets', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    addUser(ctx, 'Bert');
    expect(ctx.planets.home('u_Anna')).toBeNull();
    addPlanet(ctx, 'u_Anna', { g: 2, s: 7, p: 4, created: 5 });
    addPlanet(ctx, 'u_Anna', { g: 1, s: 30, p: 13, created: 9 });
    addPlanet(ctx, 'u_Anna', { g: 1, s: 2, p: 3, created: 5 });
    addPlanet(ctx, 'u_Bert', { g: 1, s: 1, p: 1, created: 1 });
    expect(ctx.planets.home('u_Anna')?.id).toBe('p1_2_3');
    expect(ctx.planets.ofOwner('u_Anna').map((p) => p.id)).toEqual([
      'p1_2_3',
      'p2_7_4',
      'p1_30_13',
    ]);
    expect(ctx.planets.all().map((p) => p.id)).toEqual([
      'p1_1_1',
      'p1_2_3',
      'p1_30_13',
      'p2_7_4',
    ]);
  });

  it('reports the used size and deletes all planets', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    expect(ctx.planets.usedSize()).toEqual({ g: 0, s: 0, p: 0 });
    addPlanet(ctx, 'u_Anna', { g: 2, s: 7, p: 4 });
    addPlanet(ctx, 'u_Anna', { g: 1, s: 30, p: 13 });
    expect(ctx.planets.usedSize()).toEqual({ g: 2, s: 30, p: 13 });
    ctx.planets.deleteAll();
    expect(ctx.planets.all()).toEqual([]);
    expect(
      ctx.db.prepare('SELECT COUNT(*) FROM planet_buildings').pluck().get(),
    ).toBe(0);
  });

  it('stores the kind of a place on insert, never on update (#119)', () => {
    const ctx = testCtx();
    addUser(ctx, 'Anna');
    const p = addPlanet(ctx, 'u_Anna');
    expect(ctx.planets.get(p.id)?.kind).toBe('planet');
    // A moon at the same coordinates is another row with its own id.
    const moon = addPlanet(ctx, 'u_Anna', {
      id: placeId({ ...p, kind: 'moon' }),
      kind: 'moon',
      name: 'Mond',
    });
    expect(ctx.planets.get('m1_1_5')).toEqual(moon);
    // The kind of a place never changes once it is stored.
    ctx.planets.save({ ...p, kind: 'moon', name: 'Neu' });
    expect(ctx.planets.get(p.id)).toMatchObject({
      kind: 'planet',
      name: 'Neu',
    });
    expect(
      ctx.db.prepare('SELECT id, kind FROM planets ORDER BY id').all(),
    ).toEqual([
      { id: 'm1_1_5', kind: 'moon' },
      { id: 'p1_1_5', kind: 'planet' },
    ]);
    // Two places of the same kind at the same coordinates are refused.
    expect(() => addPlanet(ctx, 'u_Anna', { id: 'p_other' })).toThrow(
      'UNIQUE constraint failed: planets.g, planets.s, planets.p, planets.kind',
    );
  });
});
