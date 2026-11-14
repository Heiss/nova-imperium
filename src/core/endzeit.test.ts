// „Endzeit“ (#161): what the gift holds and the levels it raises (D1, D2).
import { describe, expect, it } from 'vitest';
import { BUILD, MOBILE, RES, SHIPS, UNIT } from './catalog.ts';
import {
  GIFT_DEFAULT_MINUTES,
  GIFT_MINIMUM,
  GIFT_MINUTES,
  GIFT_RESOURCES,
  GIFT_SHIPS_EACH,
  giftCargo,
  giftLevels,
  giftShips,
  highest,
  overtaken,
  raise,
} from './endzeit.ts';
import type { Requirements } from './types.ts';

describe('the gift fleet (D1)', () => {
  it('holds 42 of every ship that flies and no Sonnenreliquiar', () => {
    const ships = giftShips();
    expect(GIFT_SHIPS_EACH).toBe(42);
    expect(Object.keys(ships).sort()).toEqual(Object.keys(MOBILE).sort());
    expect(Object.values(ships).every((n) => n === 42)).toBe(true);
    expect(ships).not.toHaveProperty('sat');
    expect(Object.keys(SHIPS).filter((k) => !(k in ships))).toEqual(['sat']);
    expect(ships).toMatchObject({ dstar: 42, sc: 42, probe: 42 });
  });

  it('carries 1,000,000 of every resource', () => {
    expect(GIFT_RESOURCES).toBe(1_000_000);
    expect(giftCargo()).toEqual({ m: 1e6, c: 1e6, d: 1e6 });
  });

  it('flies 4 h by default, 1 minute to 72 h', () => {
    expect(GIFT_DEFAULT_MINUTES).toBe(240);
    expect(GIFT_MINUTES).toEqual({ min: 1, max: 4320 });
  });
});

describe('the levels of the gift (D2)', () => {
  it('takes the highest level of each key', () => {
    expect(highest([{ a: 2, b: 5 }, undefined, { a: 7 }, { b: 1 }])).toEqual({
      a: 7,
      b: 5,
    });
    expect(highest([])).toEqual({});
  });

  it('derives the levels from the requirements with the minimums', () => {
    const entries: { req?: Requirements }[] = [
      { req: { b: { yard: 4 }, r: { laser: 3 } } },
      { req: { b: { yard: 12 } } },
      { req: { r: { laser: 1, ion: 2 } } },
      {},
    ];
    expect(giftLevels(entries, { b: { robot: 20 }, r: { ifn: 1 } })).toEqual({
      b: { yard: 12, robot: 20 },
      r: { laser: 3, ion: 2, ifn: 1 },
    });
    // A minimum below a requirement does not lower it.
    expect(giftLevels(entries, { b: { yard: 5 }, r: {} })).toEqual({
      b: { yard: 12 },
      r: { laser: 3, ion: 2 },
    });
  });

  it('has the minimums of the owner: robot, yard, lab 20, nanite 5, IFN 1', () => {
    expect(GIFT_MINIMUM).toEqual({
      b: { robot: 20, yard: 20, lab: 20, nanite: 5 },
      r: { ifn: 1 },
    });
    const { b, r } = giftLevels();
    expect(b).toMatchObject({ robot: 20, yard: 20, lab: 20, nanite: 5 });
    expect(r.ifn).toBe(1);
  });

  it('meets every requirement of every entry of the catalog', () => {
    const { b, r } = giftLevels();
    for (const def of [
      ...Object.values(BUILD),
      ...Object.values(RES),
      ...Object.values(UNIT),
    ]) {
      for (const [k, n] of Object.entries(def.req?.b ?? {}))
        expect(b[k]).toBeGreaterThanOrEqual(n);
      for (const [k, n] of Object.entries(def.req?.r ?? {}))
        expect(r[k]).toBeGreaterThanOrEqual(n);
    }
    // For example the Todesstern: yard 12 (20 by the minimum), Graviton 1.
    expect(SHIPS.dstar!.req).toMatchObject({
      b: { yard: 12 },
      r: { graviton: 1 },
    });
    expect(r.graviton).toBe(1);
    expect(b.yard).toBe(20);
  });

  it('raises only what a requirement needs; the rest stays unraised', () => {
    const { b, r } = giftLevels();
    const needed = new Set(
      [
        ...Object.values(BUILD),
        ...Object.values(RES),
        ...Object.values(UNIT),
      ].flatMap((d) => Object.keys(d.req?.r ?? {})),
    );
    for (const k of Object.keys(r))
      expect(needed.has(k) || k in GIFT_MINIMUM.r).toBe(true);
    // No requirement needs a mine.
    expect(b).not.toHaveProperty('metal');
    expect(r.graviton).toBe(
      Math.max(
        ...[...Object.values(BUILD), ...Object.values(RES)]
          .concat(Object.values(UNIT))
          .map((d) => d.req?.r?.graviton ?? 0),
      ),
    );
  });

  it('keeps higher levels and adds the missing ones', () => {
    expect(
      raise({ yard: 25, metal: 30, lab: 3 }, { yard: 20, lab: 20 }),
    ).toEqual({ yard: 25, metal: 30, lab: 20 });
    expect(raise({}, { ifn: 1 })).toEqual({ ifn: 1 });
  });
});

describe('a running order the gift overtakes', () => {
  it('ends when its level is not above the new level', () => {
    const levels = { robot: 20 };
    expect(overtaken({ key: 'robot', lvl: 20 }, levels)).toBe(true);
    expect(overtaken({ key: 'robot', lvl: 19 }, levels)).toBe(true);
    expect(overtaken({ key: 'robot', lvl: 21 }, levels)).toBe(false);
    expect(overtaken({ key: 'metal', lvl: 1 }, levels)).toBe(false);
    expect(overtaken(null, levels)).toBe(false);
    expect(overtaken(undefined, levels)).toBe(false);
  });
});
