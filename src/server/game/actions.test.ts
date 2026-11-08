import { describe, expect, it } from 'vitest';
import { addPlanet, addUser, testCtx } from '../test-helpers.ts';
import * as A from './actions.ts';

function setup(planet = {}, user = {}) {
  const ctx = testCtx();
  const u = addUser(ctx, 'Anna', user);
  addPlanet(ctx, u.id, planet);
  const p = () => ctx.store.planetOfUser(u.id)!;
  const me = () => ctx.store.user(u.id)!;
  return { ctx, u, p, me };
}

describe('buildings', () => {
  it('start, pay and finish', () => {
    const { ctx, u, p } = setup({ res: { m: 1000, c: 1000, d: 0 } });
    expect(A.build(ctx, u, { key: 'metal' })).toBeNull();
    expect(p().res).toEqual({ m: 940, c: 985, d: 0 });
    expect(p().bq).toEqual({
      key: 'metal',
      lvl: 1,
      start: ctx.now(),
      end: ctx.now() + 21600,
      cost: [60, 15, 0],
    });
    ctx.clock.t += 21600;
    expect(A.mine(ctx, u).b.metal).toBe(1);
  });
  it('persists a solar upgrade with a fractional calculated duration', () => {
    const { ctx, u, p } = setup({ b: { robot: 1, solar: 1 } });
    ctx.store.saveUniverse({ ...ctx.store.universe(), speed: 7 });
    expect(A.build(ctx, u, { key: 'solar' })).toBeNull();
    const due = p().bq!.end;
    expect(Number.isInteger(due)).toBe(true);
    ctx.clock.t = due - 1;
    expect(A.mine(ctx, u).b.solar).toBe(1);
    ctx.clock.t = due;
    expect(A.mine(ctx, u).b.solar).toBe(2);
  });
  it('are refused when busy, missing requirements or resources', () => {
    const { ctx, u } = setup({ res: { m: 10, c: 10, d: 0 }, b: { robot: 2 } });
    expect(() => A.build(ctx, u, { key: 'nope' })).toThrow(
      'Unbekanntes Gebäude.',
    );
    expect(() => A.build(ctx, u, { key: 'metal' })).toThrow(
      'Nicht genug Rohstoffe.',
    );
    const { ctx: c2, u: u2 } = setup();
    expect(() => A.build(c2, u2, { key: 'yard' })).toThrow(
      'Voraussetzungen fehlen.',
    );
    A.build(c2, u2, { key: 'metal' });
    expect(() => A.build(c2, u2, { key: 'crystal' })).toThrow(
      'Es wird bereits gebaut.',
    );
  });
  it('wait for the shipyard and the lab', () => {
    const { ctx, u } = setup({
      b: { robot: 2, yard: 1, lab: 1 },
      sq: [{ key: 'rl', n: 9, unit: 1e9 }],
      sqT: 1_000_000,
    });
    expect(() => A.build(ctx, u, { key: 'yard' })).toThrow(
      'Die Werft arbeitet gerade.',
    );
    A.research(ctx, u, { key: 'energy' });
    expect(() => A.build(ctx, u, { key: 'lab' })).toThrow(
      'Das Labor forscht gerade.',
    );
  });
  it('can be cancelled with a full refund', () => {
    const { ctx, u, p } = setup({ res: { m: 1000, c: 1000, d: 0 } });
    expect(A.cancelBuild(ctx, u, {})).toBeNull();
    A.build(ctx, u, { key: 'metal' });
    A.cancelBuild(ctx, u, {});
    expect(p().res).toEqual({ m: 1000, c: 1000, d: 0 });
    expect(p().bq).toBeNull();
  });
  it('need a planet', () => {
    const ctx = testCtx();
    const u = addUser(ctx, 'Nobody');
    expect(() => A.mine(ctx, u)).toThrow('Du hast keinen Planeten.');
  });
});

describe('research', () => {
  it('needs a lab and runs one at a time', () => {
    const { ctx, u, p, me } = setup();
    expect(() => A.research(ctx, u, { key: 'energy' })).toThrow(
      'Forschungslabor',
    );
    const { ctx: c2, u: u2, p: p2, me: me2 } = setup({ b: { lab: 1 } });
    expect(() => A.research(c2, u2, { key: 'nope' })).toThrow(
      'Unbekannte Forschung.',
    );
    expect(() => A.research(c2, u2, { key: 'laser' })).toThrow(
      'Voraussetzungen fehlen.',
    );
    A.research(c2, u2, { key: 'energy' });
    expect(me2().rq).toMatchObject({
      key: 'energy',
      lvl: 1,
      cost: [0, 800, 400],
    });
    expect(p2().res).toEqual({ m: 100000, c: 99200, d: 99600 });
    expect(() => A.research(c2, me2(), { key: 'computer' })).toThrow(
      'Es wird bereits geforscht.',
    );
    void p;
    void me;
  });
  it('waits while the lab is upgraded and finishes in time', () => {
    const { ctx, u, me } = setup({
      b: { lab: 1 },
      bq: { key: 'lab', lvl: 2, start: 0, end: 2e6, cost: [0, 0, 0] },
    });
    expect(() => A.research(ctx, u, { key: 'energy' })).toThrow(
      'Das Labor wird ausgebaut.',
    );
    ctx.clock.t = 2e6;
    A.research(ctx, me(), { key: 'energy' });
    const end = me().rq!.end;
    // (0 + 800) / (1000 * (1 + lab 2)) hours at speed 5
    expect(end - ctx.now()).toBe(192000);
    ctx.clock.t = end;
    expect(A.researchOf(ctx, me()).research.energy).toBe(1);
  });
  it('can be cancelled', () => {
    const { ctx, u, p, me } = setup({ b: { lab: 1 } });
    expect(A.cancelResearch(ctx, u, {})).toBeNull();
    A.research(ctx, u, { key: 'energy' });
    A.cancelResearch(ctx, me(), {});
    expect(me().rq).toBeNull();
    expect(p().res).toEqual({ m: 100000, c: 100000, d: 100000 });
  });
  it('is refused without resources', () => {
    const { ctx, u } = setup({ b: { lab: 1 }, res: { m: 0, c: 0, d: 0 } });
    expect(() => A.research(ctx, u, { key: 'energy' })).toThrow(
      'Nicht genug Rohstoffe.',
    );
  });
});

describe('shipyard', () => {
  it('orders as many units as can be paid', () => {
    const { ctx, u, p } = setup({
      b: { yard: 1 },
      res: { m: 5000, c: 0, d: 0 },
    });
    expect(A.order(ctx, u, { key: 'rl', n: 9 })).toBe(
      '2× Raketenwerfer in Auftrag gegeben.',
    );
    expect(p().sq).toEqual([{ key: 'rl', n: 2, unit: 288000 }]);
    expect(p().sqT).toBe(ctx.now());
    expect(p().res.m).toBe(1000);
  });
  it('keeps the start time when the list is not empty', () => {
    const { ctx, u, p } = setup({
      b: { yard: 1 },
      sq: [{ key: 'rl', n: 1, unit: 1e9 }],
      sqT: 5,
    });
    A.order(ctx, u, { key: 'rl', n: 1 });
    expect(p().sqT).toBe(5);
    expect(p().sq).toHaveLength(2);
  });
  it('refuses wrong orders', () => {
    const { ctx, u } = setup();
    expect(() => A.order(ctx, u, { key: 'x' })).toThrow('Unbekannte Einheit.');
    expect(() => A.order(ctx, u, { key: 'rl', n: 1 })).toThrow(
      'Raumschiffwerft',
    );
    const s = setup({
      b: { yard: 1 },
      bq: { key: 'yard', lvl: 2, start: 0, end: 9e9, cost: [0, 0, 0] },
    });
    expect(() => A.order(s.ctx, s.u, { key: 'rl', n: 1 })).toThrow(
      'Die Werft wird ausgebaut.',
    );
    const t = setup({ b: { yard: 1 } });
    expect(() => A.order(t.ctx, t.u, { key: 'gauss', n: 1 })).toThrow(
      'Voraussetzungen fehlen.',
    );
    expect(() => A.order(t.ctx, t.u, { key: 'rl', n: 0 })).toThrow(
      'Nicht genug Rohstoffe.',
    );
    const full = Array.from({ length: 20 }, () => ({
      key: 'rl',
      n: 1,
      unit: 1e9,
    }));
    const v = setup({ b: { yard: 1 }, sq: full, sqT: 1 });
    expect(() => A.order(v.ctx, v.u, { key: 'rl', n: 1 })).toThrow(
      'Die Bauliste der Werft ist voll.',
    );
  });
});

describe('planet settings', () => {
  it('set the production share in steps of 10', () => {
    const { ctx, u, p } = setup();
    A.pct(ctx, u, { key: 'metal', v: 44 });
    expect(p().pct.metal).toBe(40);
    A.pct(ctx, u, { key: 'solar', v: 999 });
    expect(p().pct.solar).toBe(100);
    expect(() => A.pct(ctx, u, { key: 'lab', v: 10 })).toThrow('Ungültig.');
  });
  it('rename the planet', () => {
    const { ctx, u, p } = setup();
    A.rename(ctx, u, { name: '  Neu\u0007Welt  ' });
    expect(p().name).toBe('NeuWelt');
    expect(() => A.rename(ctx, u, { name: '   ' })).toThrow(
      'Bitte einen Namen',
    );
  });
  it('save the number of probes', () => {
    const { ctx, u, me } = setup();
    expect(A.options(ctx, u, { probes: 0 })).toBe('Gespeichert.');
    expect(me().probes).toBe(1);
    A.options(ctx, u, { probes: 5 });
    expect(me().probes).toBe(5);
  });
});

describe('reports', () => {
  it('are marked read, deleted one by one or all', () => {
    const { ctx, u, me } = setup();
    ctx.store.addReport(
      u.id,
      { id: 'r1', time: 50, type: 'info', title: 'a' },
      60,
    );
    ctx.store.addReport(
      u.id,
      { id: 'r2', time: 70, type: 'info', title: 'b' },
      60,
    );
    A.read(ctx, u, {});
    expect(me().readAt).toBe(70);
    A.delrep(ctx, u, { id: 'r1' });
    expect(ctx.store.reports(u.id).map((r) => r.id)).toEqual(['r2']);
    A.delall(ctx, u, {});
    expect(ctx.store.reports(u.id)).toEqual([]);
    A.read(ctx, me(), {});
    expect(me().readAt).toBe(0);
  });
});
