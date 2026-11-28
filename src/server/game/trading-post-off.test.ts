// The Handelsposten while the marketplace is off (#442, owner, 2026-11-27,
// 226b, 227b): no new level, the server's refusal is the marketplace's; the
// built levels stay, count for the points and can be demolished with the
// refund; a level already in the queue finishes [V]; with the marketplace on
// again the building is back with its levels.
import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import * as A from './actions.ts';
import { demolish } from './demolition.ts';
import { pointsMap } from './points.ts';

const CLOSED = 'Der Marktplatz ist in dieser Runde geschlossen.';
const rich = { m: 1e7, c: 1e7, d: 1e7 };

function setup(b: Record<string, number> = { robot: 4, market: 2 }) {
  const ctx = testCtx();
  const u = addUser(ctx, 'Anna');
  addPlanet(ctx, u.id, { b, res: rich });
  const p = () => ctx.planets.home(u.id)!;
  const marketOn = (on: 0 | 1) =>
    ctx.admin.saveUniverse({ ...ctx.admin.universe(), roundMarketOn: on });
  return { ctx, u, p, marketOn };
}

describe('the Handelsposten while the marketplace is off (#442)', () => {
  it('refuses its next level with the words of the marketplace', () => {
    const { ctx, u, p, marketOn } = setup();
    marketOn(0);
    expect(() => A.build(ctx, u, { key: 'market', planet: p().id })).toThrow(
      CLOSED,
    );
    expect(p().bq).toBeNull();
    expect(p().b.market).toBe(2);
    expect(p().res).toEqual(rich);
  });

  it('builds the next level again once the marketplace is on', () => {
    const { ctx, u, p, marketOn } = setup();
    marketOn(0);
    marketOn(1);
    A.build(ctx, u, { key: 'market', planet: p().id });
    expect(p().bq).toMatchObject({ key: 'market', lvl: 3 });
  });

  it('refuses only the Handelsposten; other buildings are built', () => {
    const { ctx, u, p, marketOn } = setup();
    marketOn(0);
    A.build(ctx, u, { key: 'metal', planet: p().id });
    expect(p().bq).toMatchObject({ key: 'metal', lvl: 1 });
  });

  it('keeps the built levels in the points', () => {
    const { ctx, u, marketOn } = setup();
    const on = pointsMap(ctx)[u.id];
    marketOn(0);
    expect(pointsMap(ctx)[u.id]).toBe(on);
    expect(on).toBeGreaterThan(0);
  });

  it('demolishes a level while off, with the refund of the round', () => {
    const { ctx, u, p, marketOn } = setup();
    marketOn(0);
    expect(demolish(ctx, u, { key: 'market' })).toBeNull();
    // Level 2 costs 10,000 / 20,000 / 10,000: back half at +50 %.
    expect(p().bq).toMatchObject({
      key: 'market',
      lvl: 1,
      back: [5000, 10000, 5000],
    });
    ctx.clock.t = p().bq!.end;
    expect(A.mine(ctx, u).b.market).toBe(1);
  });

  it('finishes a level that was already in the queue when it was switched off [V]', () => {
    const { ctx, u, p, marketOn } = setup();
    A.build(ctx, u, { key: 'market', planet: p().id });
    const end = p().bq!.end;
    marketOn(0);
    ctx.clock.t = end;
    expect(A.mine(ctx, u).b.market).toBe(3);
  });
});
