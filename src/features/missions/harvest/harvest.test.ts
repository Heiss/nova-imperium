// Bergung (#45, owner, 2026-11-13): only with a Bergungsbarke and only to a
// Trümmerfeld; the cargo of all ships counts; both resources evenly until
// the smaller one is used up, then the rest of the other; the first fleet to
// arrive takes the debris; a fleet that finds no field flies back empty.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { sendError } from '../../../core/missions.ts';
import type { Fleet, Levels } from '../../../core/types.ts';
import { tick } from '../../../server/game/arrival.ts';
import { send } from '../../../server/game/fleet-actions.ts';
import { addPlanet, addUser, testCtx } from '../../../server/test-helpers.ts';
import { harvest, onArrive } from './arrive.server.ts';
import * as rules from './rules.ts';
import { canSend } from './rules.ts';

const FIELD = { g: 1, s: 2, p: 6 };

function setup(ships: Levels = { recycler: 3, lc: 2, sc: 1 }) {
  const ctx = testCtx(1_000_000, 42);
  const anna = addUser(ctx, 'Anna');
  addPlanet(ctx, anna.id, {
    g: 1,
    s: 1,
    p: 5,
    ships,
    res: { m: 0, c: 0, d: 100000 },
  });
  return { ctx, anna };
}

const fleet = (over: Partial<Fleet> = {}): Fleet => ({
  id: 'f1',
  owner: 'u_Anna',
  from: 'p1_1_5',
  fromC: { g: 1, s: 1, p: 5 },
  to: 'd1_2_6',
  toC: FIELD,
  mission: 'harvest',
  ships: { recycler: 1 },
  cargo: { m: 0, c: 0, d: 0 },
  dep: 999_000,
  arr: 1_000_000,
  ret: 1_001_000,
  state: 'out',
  recalled: false,
  fuel: 10,
  ...over,
});

const texts = (ctx: ReturnType<typeof testCtx>) =>
  ctx.reports.ofPlayer('u_Anna').map((r) => [r.title, r.text]);

describe('harvest: the rules', () => {
  it('flies to a Trümmerfeld, carries no load of its own and flies back', () => {
    expect(rules).toMatchObject({
      order: 60,
      target: 'debris',
      cargo: false,
      returns: true,
      visible: false,
      silent: false,
    });
  });

  it('needs at least one Bergungsbarke in the fleet', () => {
    const f = (ships: Levels) => ({ owner: 'a', from: 'p1', ships });
    expect(canSend(f({ recycler: 1 }))).toBeUndefined();
    expect(canSend(f({ recycler: 2, lc: 5, probe: 1 }))).toBeUndefined();
    expect(canSend(f({ lc: 5, sc: 3 }))).toBe('noRecycler');
    expect(canSend(f({ recycler: 0, lc: 1 }))).toBe('noRecycler');
    expect(canSend(f({}))).toBe('noRecycler');
  });

  it('flies only to a position with a Trümmerfeld, then needs a Bergungsbarke', () => {
    const target = (debris: boolean) => ({
      planet: { id: 'p1_2_6', owner: 'b' },
      debris,
      protects: () => true,
    });
    const with_ = { owner: 'a', from: 'p1', ships: { recycler: 1 } };
    const without = { owner: 'a', from: 'p1', ships: { lc: 1 } };
    expect(sendError(rules, with_, target(true))).toBeUndefined();
    expect(sendError(rules, with_, target(false))).toBe('noDebris');
    expect(sendError(rules, without, target(false))).toBe('noDebris');
    expect(sendError(rules, without, target(true))).toBe('noRecycler');
  });
});

describe('harvest: what the holds take', () => {
  it('takes both evenly until the smaller is used up, then the rest of the other', () => {
    // The example of the classic rules: one Recycler at 40,000 / 15,000.
    expect(harvest({ m: 40000, c: 15000 }, 20000)).toEqual({
      m: 10000,
      c: 10000,
    });
    expect(harvest({ m: 40000, c: 5000 }, 20000)).toEqual({
      m: 15000,
      c: 5000,
    });
    expect(harvest({ m: 15000, c: 40000 }, 20000)).toEqual({
      m: 10000,
      c: 10000,
    });
    expect(harvest({ m: 5000, c: 40000 }, 20000)).toEqual({
      m: 5000,
      c: 15000,
    });
    expect(harvest({ m: 300, c: 300 }, 400)).toEqual({ m: 200, c: 200 });
    expect(harvest({ m: 0, c: 700.5 }, 400)).toEqual({ m: 0, c: 400 });
  });

  it('takes the whole field when the holds are big enough, nothing without room', () => {
    expect(harvest({ m: 1800.3, c: 600 }, 20000)).toEqual({
      m: 1800.3,
      c: 600,
    });
    expect(harvest({ m: 1800, c: 600 }, 2400)).toEqual({ m: 1800, c: 600 });
    expect(harvest({ m: 1800, c: 600 }, 0)).toEqual({ m: 0, c: 0 });
    expect(harvest({ m: 1800, c: 600 }, -50)).toEqual({ m: 0, c: 0 });
  });

  it('never takes more than the field or the holds, and fills them evenly', () => {
    // Whole amounts and hundredths, like the 30 % shares of a field.
    const amount = fc.oneof(
      fc.integer({ min: 0, max: 1e7 }),
      fc.integer({ min: 0, max: 1e9 }).map((x) => x / 100),
    );
    fc.assert(
      fc.property(amount, amount, amount, (m, c, free) => {
        const t = harvest({ m, c }, free);
        expect(t.m).toBeGreaterThanOrEqual(0);
        expect(t.c).toBeGreaterThanOrEqual(0);
        expect(t.m).toBeLessThanOrEqual(m);
        expect(t.c).toBeLessThanOrEqual(c);
        expect(t.m + t.c).toBeLessThanOrEqual(free * (1 + 1e-12));
        // The smaller resource up to half the room, the other fills the rest.
        const small = Math.min(m, c);
        expect(Math.min(t.m, t.c)).toBe(Math.min(small, free / 2));
        if (m + c <= free) expect(t).toEqual({ m, c });
        else expect(t.m + t.c).toBeCloseTo(free, 3);
      }),
      { seed: 45, numRuns: 500 },
    );
  });
});

describe('harvest: the arrival', () => {
  it('fills the cargo of all ships of the fleet, leaves the rest and flies home with it', () => {
    const { ctx } = setup();
    ctx.debris.add(FIELD, { m: 100000, c: 30000 });
    // One Bergungsbarke (20,000) and two Lastbarken (25,000 each).
    const f = fleet({ ships: { recycler: 1, lc: 2 } });
    ctx.fleets.save(f);
    onArrive(ctx, f);
    expect(ctx.debris.get('d1_2_6')).toMatchObject({ m: 60000, c: 0 });
    const back = ctx.fleets.get('f1')!;
    expect(back.state).toBe('back');
    expect(back.cargo).toEqual({ m: 40000, c: 30000, d: 0 });
    expect(texts(ctx)).toEqual([
      [
        'Bergung erreicht [1:2:6]',
        'Deine Bergungsbarken haben 40.000 Adamant und 30.000 Psikristall geborgen.',
      ],
    ]);
    expect(ctx.reports.ofPlayer('u_Anna')[0]!.time).toBe(f.arr);
  });

  it('takes the whole field, which disappears, and keeps what the fleet carries', () => {
    const { ctx } = setup();
    ctx.debris.add(FIELD, { m: 1800, c: 600.5 });
    const f = fleet({ cargo: { m: 0, c: 0, d: 7 } });
    ctx.fleets.save(f);
    onArrive(ctx, f);
    expect(ctx.debris.all()).toEqual([]);
    expect(ctx.fleets.get('f1')!.cargo).toEqual({ m: 1800, c: 600.5, d: 7 });
    expect(texts(ctx)[0]![1]).toBe(
      'Deine Bergungsbarken haben 1.800 Adamant und 600 Psikristall geborgen.',
    );
  });

  it('counts only the free room of holds that already carry something', () => {
    const { ctx } = setup();
    ctx.debris.add(FIELD, { m: 50000, c: 50000 });
    const f = fleet({ cargo: { m: 1000, c: 2000, d: 3000 } });
    ctx.fleets.save(f);
    onArrive(ctx, f);
    expect(ctx.fleets.get('f1')!.cargo).toEqual({
      m: 1000 + 7000,
      c: 2000 + 7000,
      d: 3000,
    });
    expect(ctx.debris.get('d1_2_6')).toMatchObject({ m: 43000, c: 43000 });
  });

  it('lets the first fleet take the debris; the next finds none, flies back empty with a report', () => {
    const { ctx } = setup();
    ctx.debris.add(FIELD, { m: 1000, c: 1000 });
    ctx.fleets.save(fleet({ id: 'a', arr: 999_500 }));
    ctx.fleets.save(fleet({ id: 'b', arr: 999_800 }));
    tick(ctx);
    expect(ctx.fleets.get('a')).toMatchObject({
      state: 'back',
      cargo: { m: 1000, c: 1000, d: 0 },
    });
    expect(ctx.fleets.get('b')).toMatchObject({
      state: 'back',
      cargo: { m: 0, c: 0, d: 0 },
    });
    expect(ctx.debris.all()).toEqual([]);
    expect(texts(ctx)).toEqual([
      ['Flotte kehrt um', 'An der Position war kein Trümmerfeld mehr.'],
      [
        'Bergung erreicht [1:2:6]',
        'Deine Bergungsbarken haben 1.000 Adamant und 1.000 Psikristall geborgen.',
      ],
    ]);
  });

  it('gives a later fleet what is left', () => {
    const { ctx } = setup();
    ctx.debris.add(FIELD, { m: 30000, c: 10000 });
    ctx.fleets.save(fleet({ id: 'a', arr: 999_500 }));
    ctx.fleets.save(fleet({ id: 'b', arr: 999_800 }));
    tick(ctx);
    expect(ctx.fleets.get('a')!.cargo).toEqual({ m: 10000, c: 10000, d: 0 });
    expect(ctx.fleets.get('b')!.cargo).toEqual({ m: 20000, c: 0, d: 0 });
    expect(ctx.debris.all()).toEqual([]);
  });
});

describe('harvest: sending', () => {
  it('flies a fleet with a Bergungsbarke to the Trümmerfeld, without a load', () => {
    const { ctx, anna } = setup();
    ctx.debris.add(FIELD, { m: 10, c: 10 });
    expect(
      send(ctx, anna, {
        planet: 'p1_1_5',
        ships: { recycler: 1, lc: 2 },
        to: FIELD,
        mission: 'harvest',
        cargo: { m: 0, c: 0, d: 500 },
        pct: 10,
      }),
    ).toBe('Flotte unterwegs nach [1:2:6].');
    expect(ctx.fleets.all()).toMatchObject([
      {
        to: 'd1_2_6',
        toC: FIELD,
        mission: 'harvest',
        ships: { recycler: 1, lc: 2 },
        cargo: { m: 0, c: 0, d: 0 },
      },
    ]);
  });

  it('refuses a position without a Trümmerfeld and a fleet without a Bergungsbarke', () => {
    const { ctx, anna } = setup();
    const order = (ships: Levels) => () =>
      send(ctx, anna, {
        planet: 'p1_1_5',
        ships,
        to: FIELD,
        mission: 'harvest',
        pct: 10,
      });
    expect(order({ recycler: 1 })).toThrow(
      'An dieser Position gibt es kein Trümmerfeld.',
    );
    ctx.debris.add(FIELD, { m: 10, c: 10 });
    expect(order({ lc: 1 })).toThrow('Du brauchst eine Bergungsbarke.');
    expect(ctx.fleets.all()).toEqual([]);
  });

  it('logs no target player: the field belongs to nobody', () => {
    const { ctx, anna } = setup();
    addUser(ctx, 'Bert');
    addPlanet(ctx, 'u_Bert', { ...FIELD, name: 'Beta' });
    ctx.debris.add(FIELD, { m: 10, c: 10 });
    const event = { category: 'game' as const, action: 'send' };
    send(
      ctx,
      anna,
      {
        planet: 'p1_1_5',
        ships: { recycler: 1 },
        to: FIELD,
        mission: 'harvest',
        pct: 10,
      },
      event,
    );
    expect(event).not.toHaveProperty('target');
    expect(event).toMatchObject({ detail: { planet: 'd1_2_6' } });
  });
});
