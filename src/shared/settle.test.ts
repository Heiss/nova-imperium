import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { settle, settleR } from './settle.ts';

const H = 3600000;

describe('settle', () => {
  it('does not change the source and moves the time forward', () => {
    const src = planet({ t: 1000 });
    const p = settle(src, 1000 + H, U);
    expect(src.res.m).toBe(500);
    expect(src.t).toBe(1000);
    expect(p.res).toEqual({ m: 600, c: 550, d: 0 });
    expect(p.t).toBe(1000 + H);
  });
  it('never goes back in time', () => {
    const p = settle(planet({ t: 5000 }), 1000, U);
    expect(p.t).toBe(5000);
    expect(p.res.m).toBe(500);
  });
  it('finishes a building on time and produces with the new level afterwards', () => {
    const src = planet({
      bq: { key: 'metal', lvl: 1, start: 0, end: H, cost: [60, 15, 0] },
    });
    const p = settle(src, 2 * H, U);
    expect(p.b.metal).toBe(1);
    expect(p.bq).toBeNull();
    // First hour base income (100), second hour with metal mine 1 (energy factor 0).
    expect(p.res.m).toBe(700);
  });
  it('keeps a building that is not finished', () => {
    const src = planet({
      bq: { key: 'metal', lvl: 1, start: 0, end: 2 * H, cost: [60, 15, 0] },
    });
    const p = settle(src, H, U);
    expect(p.b.metal).toBeUndefined();
    expect(p.bq?.end).toBe(2 * H);
  });
  it('finishes a building that ends exactly now', () => {
    const p = settle(
      planet({
        bq: { key: 'lab', lvl: 2, start: 0, end: 10, cost: [1, 1, 1] },
      }),
      10,
      U,
    );
    expect(p.b.lab).toBe(2);
  });
  it('finishes a building that ended before the last state', () => {
    const src = planet({
      t: 100,
      bq: { key: 'lab', lvl: 2, start: 0, end: 50, cost: [1, 1, 1] },
    });
    expect(settle(src, 100, U).b.lab).toBe(2);
  });
  it('delivers ships and defense one after another', () => {
    const src = planet({
      sq: [
        { key: 'lf', n: 3, unit: 100 },
        { key: 'rl', n: 2, unit: 50 },
      ],
      sqT: 0,
    });
    const a = settle(src, 250, U);
    expect(a.ships).toEqual({ lf: 2 });
    expect(a.sq).toEqual([
      { key: 'lf', n: 1, unit: 100 },
      { key: 'rl', n: 2, unit: 50 },
    ]);
    expect(a.sqT).toBe(200);
    const b = settle(src, 360, U);
    expect(b.ships).toEqual({ lf: 3 });
    expect(b.def).toEqual({ rl: 1 });
    expect(b.sqT).toBe(350);
    const c = settle(src, 1000, U);
    expect(c.def).toEqual({ rl: 2 });
    expect(c.sq).toEqual([]);
    expect(c.sqT).toBeNull();
  });
  it('adds to units that exist', () => {
    const src = planet({
      ships: { lf: 4 },
      sq: [{ key: 'lf', n: 1, unit: 10 }],
      sqT: 0,
    });
    expect(settle(src, 10, U).ships.lf).toBe(5);
  });
  it('starts the shipyard now when its start time is missing', () => {
    const src = planet({
      t: 0,
      sq: [{ key: 'lf', n: 1, unit: 10 }],
      sqT: null,
    });
    const p = settle(src, 100, U);
    expect(p.ships).toEqual({});
    expect(p.sqT).toBe(100);
  });
});

describe('settleR', () => {
  it('finishes research when its time has come', () => {
    const src = {
      research: { energy: 1 },
      rq: {
        key: 'energy',
        lvl: 2,
        start: 0,
        end: 100,
        cost: [0, 0, 0] as const,
      },
    };
    expect(settleR(src, 99)).toEqual(src);
    expect(settleR(src, 100)).toEqual({ research: { energy: 2 }, rq: null });
    expect(src.research.energy).toBe(1);
  });
});
