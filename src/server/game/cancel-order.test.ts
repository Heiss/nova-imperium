// The action `cancelOrder` (#258, owner, 2026-11-16): an order of the
// shipyard is taken back, the units not done yet are refunded in full.
import { describe, expect, it } from 'vitest';
import { DEF, SHIPS } from '../../core/catalog.ts';
import { settle } from '../../core/settle.ts';
import { unitRoom } from '../../core/yard.ts';
import {
  addPlanet,
  addUser,
  queuedPushes,
  subscribePush,
  testCtx,
  loose,
} from '../test-helpers.ts';
import * as A from './actions.ts';
import { universe } from './context.ts';
import { ACTIONS, runAction } from './dispatch.ts';

const rl = DEF.rl!.cost;
const lf = SHIPS.lf!.cost;

function setup(planet = {}) {
  const ctx = testCtx();
  const u = addUser(ctx, 'Anna', { research: { comb: 1 } });
  addPlanet(ctx, u.id, {
    b: { yard: 1 },
    res: { m: 1_000_000, c: 1_000_000, d: 1_000_000 },
    ...planet,
  });
  const p = () => ctx.planets.home(u.id)!;
  const jobs = () =>
    ctx.db
      .prepare('SELECT kind, event_key, due FROM push_jobs ORDER BY rowid')
      .all();
  return { ctx, u, p, jobs };
}

describe('cancelling a shipyard order', () => {
  it('is an action of the game', () => {
    expect(ACTIONS.cancelOrder).toBe(A.cancelOrder);
  });

  it('removes the order and refunds the full cost of all its units, ships and defense alike', () => {
    const { ctx, u, p } = setup();
    const start = { ...p().res };
    A.order(ctx, u, { key: 'rl', n: 5 });
    A.order(ctx, u, { key: 'lf', n: 2 });
    expect(p().res.m).toBe(start.m - 5 * rl[0] - 2 * lf[0]);
    expect(A.cancelOrder(ctx, u, { pos: 1, key: 'lf' })).toBeNull();
    expect(p().sq.map((q) => [q.key, q.n])).toEqual([['rl', 5]]);
    expect(p().res.m).toBe(start.m - 5 * rl[0]);
    expect(p().res.c).toBe(start.c);
    expect(A.cancelOrder(ctx, u, { pos: 0, key: 'rl' })).toBeNull();
    expect(p().sq).toEqual([]);
    expect(p().res).toEqual(start);
  });

  it('keeps the units that are done and refunds only the rest, the one in progress included', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'lf', n: 4 });
    const unit = p().sq[0]!.unit;
    const start = { ...p().res };
    ctx.clock.t += 2.5 * unit;
    A.cancelOrder(ctx, u, { pos: 0, key: 'lf' });
    expect(p().ships.lf).toBe(2);
    expect(p().sq).toEqual([]);
    expect(p().res.m).toBe(start.m + 2 * lf[0]);
    expect(p().res.c).toBe(start.c + 2 * lf[1]);
  });

  it('lets the next order start now when the first one is cancelled', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'lf', n: 4 });
    A.order(ctx, u, { key: 'rl', n: 1 });
    ctx.clock.t += 1000;
    A.cancelOrder(ctx, u, { pos: 0, key: 'lf' });
    expect(p().sq.map((q) => q.key)).toEqual(['rl']);
    expect(p().sqT).toBe(ctx.now());
  });

  it('leaves the time of the running order when a later one is cancelled', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'lf', n: 4 });
    A.order(ctx, u, { key: 'rl', n: 1 });
    const start = p().sqT;
    ctx.clock.t += 1000;
    A.cancelOrder(ctx, u, { pos: 1, key: 'rl' });
    expect(p().sq.map((q) => q.key)).toEqual(['lf']);
    expect(p().sqT).toBe(start);
  });

  it('has no start time and an empty list when the last order is cancelled', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'rl', n: 1 });
    A.cancelOrder(ctx, u, { pos: 0, key: 'rl' });
    expect(p().sq).toEqual([]);
    expect(p().sqT).toBeNull();
    // A new order starts at its own time.
    ctx.clock.t += 5000;
    A.order(ctx, u, { key: 'rl', n: 1 });
    expect(p().sqT).toBe(ctx.now());
  });

  it('changes nothing and says nothing when the order finished meanwhile', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'rl', n: 1 });
    A.order(ctx, u, { key: 'lf', n: 1 });
    ctx.clock.t += p().sq[0]!.unit + 1;
    const res = { ...p().res };
    // The first order is done and gone: position 0 holds the other unit now.
    expect(A.cancelOrder(ctx, u, { pos: 0, key: 'rl' })).toBeNull();
    expect(A.cancelOrder(ctx, u, { pos: 3, key: 'lf' })).toBeNull();
    expect(p().res).toEqual(res);
    // The finished unit is done, never refunded.
    const settled = settle(p(), ctx.now(), universe(ctx));
    expect(settled.sq.map((q) => q.key)).toEqual(['lf']);
    expect(settled.def.rl).toBe(1);
  });

  it('refuses a planet that is not the own one and changes nothing there', () => {
    const { ctx, u } = setup();
    const bert = addUser(ctx, 'Bert');
    const theirs = addPlanet(ctx, bert.id, {
      g: 2,
      b: { yard: 1 },
      sq: [{ key: 'rl', n: 2, unit: 1e9 }],
      sqT: ctx.now(),
    });
    expect(() =>
      A.cancelOrder(ctx, u, { planet: theirs.id, pos: 0, key: 'rl' }),
    ).toThrow('Du hast keinen Zugriff auf diesen Planeten.');
    expect(ctx.planets.get(theirs.id)!.sq).toHaveLength(1);
    expect(() =>
      A.cancelOrder(ctx, u, { planet: 'p9_9_9', pos: 0, key: 'rl' }),
    ).toThrow('Du hast keinen Zugriff auf diesen Planeten.');
  });

  it('cancels on the selected planet, not on the main planet', () => {
    const { ctx, u, p } = setup();
    const colony = addPlanet(ctx, u.id, {
      g: 1,
      s: 2,
      b: { yard: 1 },
      sq: [{ key: 'rl', n: 2, unit: 1e9 }],
      sqT: ctx.now(),
    });
    A.order(ctx, u, { key: 'rl', n: 1 });
    A.cancelOrder(ctx, u, { planet: colony.id, pos: 0, key: 'rl' });
    expect(ctx.planets.get(colony.id)!.sq).toEqual([]);
    expect(p().sq).toHaveLength(1);
  });

  it('refuses a position that is no whole number from 0 on, and changes nothing', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'rl', n: 1 });
    const before = structuredClone(p());
    for (const pos of [
      undefined,
      null,
      '0',
      '',
      -1,
      0.5,
      Number.NaN,
      Infinity,
      [0],
      {},
      true,
    ])
      expect(
        () => A.cancelOrder(ctx, u, loose<'cancelOrder'>({ pos, key: 'rl' })),
        String(pos),
      ).toThrow('Ungültig.');
    expect(p()).toEqual(before);
  });

  it('does nothing for a key that is no unit', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'rl', n: 1 });
    const before = structuredClone(p());
    for (const key of [undefined, null, '', 'x', 'metal', 'toString', 1])
      expect(
        A.cancelOrder(ctx, u, loose<'cancelOrder'>({ pos: 0, key })),
      ).toBeNull();
    expect(p()).toEqual(before);
  });

  it('frees the place of a cancelled Schutzdom', () => {
    const { ctx, u, p } = setup({
      sq: [{ key: 'lsd', n: 1, unit: 1e9 }],
      sqT: 1_000_000,
    });
    expect(unitRoom(p(), 'lsd')).toBe(0);
    A.cancelOrder(ctx, u, { pos: 0, key: 'lsd' });
    expect(unitRoom(p(), 'lsd')).toBe(1);
  });

  it('is allowed while an upgrade of the shipyard locks it', () => {
    const { ctx, u, p } = setup({
      sq: [{ key: 'rl', n: 2, unit: 1e9 }],
      sqT: 1_000_000,
      bq: {
        key: 'yard',
        lvl: 2,
        start: 1_000_000,
        end: 9e12,
        cost: [0, 0, 0],
      },
    });
    const m = p().res.m;
    A.cancelOrder(ctx, u, { pos: 0, key: 'rl' });
    expect(p().sq).toEqual([]);
    expect(p().res.m).toBe(m + 2 * rl[0]);
    expect(p().bq?.key).toBe('yard');
  });

  it('runs as an action of the game, in one transaction with the settling', () => {
    const { ctx, u, p } = setup();
    A.order(ctx, u, { key: 'rl', n: 3 });
    const res = { ...p().res };
    expect(
      runAction(ctx, u.id, { type: 'cancelOrder', pos: 0, key: 'rl' }),
    ).toBeNull();
    expect(p().sq).toEqual([]);
    expect(p().res.m).toBe(res.m + 3 * rl[0]);
  });
});

describe('the push „Schiffsschmiede fertig“ after a cancel', () => {
  function withPush() {
    const s = setup();
    subscribePush(s.ctx, s.u.id);
    return s;
  }
  const endOf = (p: {
    sqT: number | null;
    sq: { n: number; unit: number }[];
  }) => p.sq.reduce((t, q) => t + q.n * q.unit, p.sqT!);

  it('moves to the new end of the list when an order stays', () => {
    const { ctx, u, p, jobs } = withPush();
    A.order(ctx, u, { key: 'rl', n: 1 });
    A.order(ctx, u, { key: 'lf', n: 2 });
    ctx.clock.t += 1000;
    A.cancelOrder(ctx, u, { pos: 0, key: 'rl' });
    const end = endOf(p());
    expect(end).toBe(ctx.now() + 2 * p().sq[0]!.unit);
    expect(jobs()).toEqual([
      { kind: 'shipyard', event_key: `${p().id}:${end}`, due: end },
    ]);
    // A later order cancelled: the end is the one of the order that stays.
    A.order(ctx, u, { key: 'rl', n: 1 });
    A.cancelOrder(ctx, u, { pos: 1, key: 'rl' });
    expect(jobs()).toEqual([
      { kind: 'shipyard', event_key: `${p().id}:${end}`, due: end },
    ]);
  });

  it('goes when the list is empty', () => {
    const { ctx, u, jobs } = withPush();
    A.order(ctx, u, { key: 'rl', n: 1 });
    expect(jobs()).toHaveLength(1);
    A.cancelOrder(ctx, u, { pos: 0, key: 'rl' });
    expect(jobs()).toEqual([]);
    expect(queuedPushes(ctx)).toEqual([]);
  });

  it('leaves the push of the research and of other planets', () => {
    const { ctx, u, jobs } = withPush();
    const colony = addPlanet(ctx, u.id, { g: 1, s: 3, b: { yard: 1 } });
    A.order(ctx, u, { key: 'rl', n: 1 });
    A.order(ctx, u, { key: 'rl', n: 1, planet: colony.id });
    expect(jobs()).toHaveLength(2);
    A.cancelOrder(ctx, u, { pos: 0, key: 'rl' });
    expect(jobs()).toEqual([
      expect.objectContaining({
        kind: 'shipyard',
        event_key: expect.stringContaining(colony.id),
      }),
    ]);
  });

  it('is not touched by a cancel that changes nothing', () => {
    const { ctx, u, jobs } = withPush();
    A.order(ctx, u, { key: 'rl', n: 1 });
    const before = jobs();
    A.cancelOrder(ctx, u, { pos: 4, key: 'rl' });
    A.cancelOrder(ctx, u, { pos: 0, key: 'lf' });
    expect(jobs()).toEqual(before);
  });
});
