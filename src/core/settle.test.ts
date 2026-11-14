import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { accrue, readsResearch, satEnergy, STOCK_USERS } from './economy.ts';
import { feelsResearch, settle, settleR } from './settle.ts';

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
  it('counts a Solarsatellit from the moment the shipyard finishes it (#46)', () => {
    const src = planet({
      temp: 8,
      b: { metal: 5, crystal: 3, solar: 1 },
      sq: [
        { key: 'lf', n: 3, unit: H / 12 },
        { key: 'sat', n: 2, unit: H / 2 },
      ],
      sqT: 0,
    });
    const p = settle(src, 2 * H, U);
    expect(p.ships).toEqual({ lf: 3, sat: 2 });
    expect(p.sq).toEqual([]);
    expect(p.sqT).toBeNull();
    // By hand: no energy until the first satellite at 3/4 h, one satellite
    // until 5/4 h, two after that.
    const want = planet({ temp: 8, b: { metal: 5, crystal: 3, solar: 1 } });
    accrue(want, (3 * H) / 4, U);
    want.ships = { sat: 1 };
    accrue(want, H / 2, U);
    want.ships = { sat: 2 };
    accrue(want, (3 * H) / 4, U);
    expect(satEnergy(8)).toBe(22);
    expect(p.res).toEqual(want.res);
    expect(p.res.m).toBeGreaterThan(
      settle(
        planet({ temp: 8, b: { metal: 5, crystal: 3, solar: 1 } }),
        2 * H,
        U,
      ).res.m,
    );
  });
  it('splits nothing for units that do not produce', () => {
    const src = planet({
      b: { metal: 5, solar: 3 },
      sq: [{ key: 'lf', n: 3, unit: H / 3 }],
      sqT: 0,
    });
    const p = settle(src, 2 * H, U);
    const want = planet({ b: { metal: 5, solar: 3 } });
    accrue(want, 2 * H, U);
    expect(p.res).toEqual(want.res);
    expect(p.ships).toEqual({ lf: 3 });
  });
  it('waits for a satellite that is not finished yet', () => {
    const src = planet({
      temp: 8,
      b: { metal: 5 },
      sq: [{ key: 'sat', n: 1, unit: 3 * H }],
      sqT: 0,
    });
    const p = settle(src, 2 * H, U);
    expect(p.ships.sat).toBeUndefined();
    expect(p.sqT).toBe(0);
    const idle = planet({
      temp: 8,
      b: { metal: 5 },
      sq: [{ key: 'sat', n: 1, unit: H }],
      sqT: null,
    });
    expect(settle(idle, 2 * H, U).ships.sat).toBeUndefined();
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

describe('the generic events of settle (#115)', () => {
  const r = { energy: 3 };
  const bq = (key: string, lvl: number) => ({
    key,
    lvl,
    start: 0,
    end: H,
    cost: [1, 1, 1] as const,
  });

  it('finds the research a rate of an entry on the planet reads', () => {
    const reactor = planet({ b: { fusion: 2, deut: 5 } });
    expect(readsResearch(reactor, U, r, 'energy')).toBe(true);
    expect(readsResearch(reactor, U, {}, 'energy')).toBe(true);
    expect(readsResearch(reactor, U, r, 'laser')).toBe(false);
    // At share 0 the reactor still reads Energietechnik, as before #115.
    const idle = planet({ b: { fusion: 2 }, pct: { fusion: 0 } });
    expect(readsResearch(idle, U, r, 'energy')).toBe(true);
    expect(r).toEqual({ energy: 3 });
  });

  it('finds none for entries that read no research or are not on the planet', () => {
    const plain = planet({
      b: { fusion: 0, deut: 5, solar: 9, metal: 3 },
      ships: { sat: 4 },
    });
    expect(readsResearch(plain, U, r, 'energy')).toBe(false);
    expect(readsResearch(planet(), U, r, 'energy')).toBe(false);
  });

  it('feels a research now or once the running building is finished', () => {
    const now = planet({ b: { fusion: 1 } });
    expect(feelsResearch(now, U, r, 'energy')).toBe(true);
    const soon = planet({ b: { deut: 5 }, bq: bq('fusion', 1) });
    expect(feelsResearch(soon, U, r, 'energy')).toBe(true);
    expect(soon.b).toEqual({ deut: 5 });
    expect(feelsResearch(soon, U, r, 'laser')).toBe(false);
    const other = planet({ b: { deut: 5 }, bq: bq('deut', 6) });
    expect(feelsResearch(other, U, r, 'energy')).toBe(false);
    expect(feelsResearch(planet({ b: { deut: 5 } }), U, r, 'energy')).toBe(
      false,
    );
  });

  it('throttles the one consumer of a stock: the Fusionskraftwerk and its deuterium', () => {
    expect(STOCK_USERS).toEqual([{ key: 'fusion', res: 'd' }]);
  });

  it('splits at the next unit with production components behind the others', () => {
    const src = planet({
      temp: 8,
      b: { metal: 5, crystal: 3, solar: 1 },
      sq: [
        { key: 'lf', n: 2, unit: H / 4 },
        { key: 'rl', n: 1, unit: H / 4 },
        { key: 'sat', n: 1, unit: H / 4 },
      ],
      sqT: 0,
    });
    const want = planet({ temp: 8, b: { metal: 5, crystal: 3, solar: 1 } });
    accrue(want, H, U);
    want.ships = { sat: 1 };
    accrue(want, H, U);
    expect(settle(src, 2 * H, U).res).toEqual(want.res);
  });
});
