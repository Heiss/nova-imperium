// Tearing stored missiles down (#54, owner, 2026-11-21): the action
// `tearDownMissiles`, its refusals, the free places of the Raketenkrypta, no
// refund, the points and the lock of the vacation mode.
import { describe, expect, it } from 'vitest';
import { siloUse } from '../../core/yard.ts';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import type { AuditEntry } from '../audit.ts';
import { ACTIONS, runAction } from './dispatch.ts';
import { pointsMap } from './points.ts';
import { TEAR_DOWN_ERROR } from './missiles.ts';
import { VACATION_REFUSED } from './vacation.ts';

const rich = { m: 10_000, c: 10_000, d: 10_000 };

function setup(def: Record<string, number> = { abm: 6, ipm: 3, rl: 4 }) {
  const ctx = testCtx();
  const u = addUser(ctx, 'Anna');
  addUser(ctx, 'Bert');
  addPlanet(ctx, u.id, { b: { yard: 1, silo: 2 }, def, res: rich });
  addPlanet(ctx, 'u_Bert', { g: 1, s: 4, p: 2, def: { abm: 5 } });
  const p = () => ctx.planets.home(u.id)!;
  const tear = (d: Record<string, unknown>, event?: AuditEntry) =>
    runAction(ctx, u.id, { type: 'tearDownMissiles', ...d }, event);
  return { ctx, u, p, tear };
}

describe('tearing missiles down (#54, 2026-11-21)', () => {
  it('is an action of the game', () => {
    expect(ACTIONS.tearDownMissiles).toBeTypeOf('function');
  });

  it('removes the amount at once, frees its places and costs and gives nothing', () => {
    const { p, tear } = setup();
    // 6 + 6 places of 20.
    expect(siloUse(p())).toEqual({ used: 12, places: 20 });
    expect(tear({ key: 'ipm', n: 2 })).toBe('2× Orbitalrakete verschrottet.');
    expect(p().def).toEqual({ abm: 6, ipm: 1, rl: 4 });
    expect(siloUse(p())).toEqual({ used: 8, places: 20 });
    expect(p().res).toEqual(rich);
    expect(tear({ key: 'abm', n: 6 })).toBe('6× Abfangrakete verschrottet.');
    expect(p().def.abm ?? 0).toBe(0);
    expect(p().res).toEqual(rich);
    expect(p().def.rl).toBe(4);
  });

  it('takes exactly the whole stock and no more', () => {
    const { p, tear } = setup();
    expect(() => tear({ key: 'abm', n: 7 })).toThrow(TEAR_DOWN_ERROR.stock);
    expect(p().def.abm).toBe(6);
    tear({ key: 'abm', n: 6 });
    expect(p().def.abm ?? 0).toBe(0);
    expect(() => tear({ key: 'abm', n: 1 })).toThrow(TEAR_DOWN_ERROR.stock);
  });

  it('refuses 0, a negative amount, a fraction and text, and changes nothing', () => {
    const { p, tear } = setup();
    for (const n of [0, -2, 1.5, 'x', '', null, undefined])
      expect(() => tear({ key: 'abm', n }), String(n)).toThrow(
        'Bitte eine Anzahl eingeben.',
      );
    expect(p().def).toEqual({ abm: 6, ipm: 3, rl: 4 });
  });

  it('refuses everything but the two missiles', () => {
    const { p, tear } = setup();
    for (const key of ['rl', 'lf', 'silo', 'nothing', undefined])
      expect(() => tear({ key, n: 1 }), String(key)).toThrow('Ungültig.');
    expect(p().def).toEqual({ abm: 6, ipm: 3, rl: 4 });
  });

  it('refuses a foreign planet and one that does not exist', () => {
    const { ctx, tear } = setup();
    const foreign = ctx.planets.home('u_Bert')!;
    expect(() => tear({ key: 'abm', n: 1, planet: foreign.id })).toThrow(
      'Du hast keinen Zugriff auf diesen Planeten.',
    );
    expect(() => tear({ key: 'abm', n: 1, planet: 'p9_9_9' })).toThrow(
      'Du hast keinen Zugriff auf diesen Planeten.',
    );
    expect(ctx.planets.get(foreign.id)!.def).toEqual({ abm: 5 });
  });

  it('tears down on the planet the player names', () => {
    const { ctx, u, tear } = setup();
    addPlanet(ctx, u.id, { g: 1, s: 2, p: 3, def: { ipm: 4 } });
    tear({ key: 'ipm', n: 4, planet: 'p1_2_3' });
    expect(ctx.planets.get('p1_2_3')!.def.ipm ?? 0).toBe(0);
    expect(ctx.planets.home(u.id)!.def.ipm).toBe(3);
  });

  it('counts only the stock: missiles in the shipyard queue are no stock', () => {
    const { ctx, u, p, tear } = setup({ abm: 1 });
    ctx.planets.save({ ...p(), sq: [{ key: 'abm', n: 5, unit: 1e9 }] });
    expect(() => tear({ key: 'abm', n: 2 })).toThrow(TEAR_DOWN_ERROR.stock);
    expect(ctx.planets.home(u.id)!.sq).toHaveLength(1);
  });

  it('writes the audit entry: planet, key and amount', () => {
    const { p, tear } = setup();
    const event: AuditEntry = { category: 'game', action: 'tearDownMissiles' };
    tear({ key: 'abm', n: 3 }, event);
    expect(event.detail).toEqual({ planet: p().id, key: 'abm', missiles: 3 });
  });

  it('lowers the points of the total, the missiles being no category (#78)', () => {
    const { ctx, u, tear } = setup();
    const before = pointsMap(ctx)[u.id]!;
    tear({ key: 'ipm', n: 3 });
    tear({ key: 'abm', n: 6 });
    expect(pointsMap(ctx)[u.id]!).toBeLessThan(before);
  });

  it('is refused for a player in vacation mode, like every action', () => {
    const { ctx, p, tear } = setup();
    ctx.players.save({ ...ctx.players.get('u_Anna')!, vacation: ctx.now() });
    expect(() => tear({ key: 'abm', n: 1 })).toThrow(VACATION_REFUSED);
    expect(p().def.abm).toBe(6);
  });

  it('words every code', () => {
    expect(TEAR_DOWN_ERROR).toEqual({
      unit: 'Ungültig.',
      count: 'Bitte eine Anzahl eingeben.',
      stock: 'Nicht so viele Raketen vorhanden.',
    });
  });

  it('lets the demolition of the Raketenkrypta follow: the places are free', () => {
    const { p, tear, u, ctx } = setup({ abm: 11 });
    expect(() =>
      runAction(ctx, u.id, { type: 'demolish', key: 'silo' }),
    ).toThrow('Die Raketenkrypta lagert zu viele Raketen.');
    tear({ key: 'abm', n: 1 });
    expect(runAction(ctx, u.id, { type: 'demolish', key: 'silo' })).toBeNull();
    expect(p().bq).toMatchObject({ key: 'silo', lvl: 1 });
    expect(p().def.abm).toBe(10);
  });
});
