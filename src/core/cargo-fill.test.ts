// The cargo buttons as one rule for the browser and the server (#240, #407).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  askOne,
  cargoIntentOf,
  fillEvenly,
  fillOne,
  loadableStock,
  resolveCargo,
  typedCargo,
} from './cargo-fill.ts';

const r = (m: number, c: number, d: number) => ({ m, c, d });

describe('the even fill (#240)', () => {
  it('gives equal shares, the extra unit to the least stock, the rest of a small stock to the others', () => {
    // On a tie the extra unit goes to Adamant (okf/features/fleet-cargo.md).
    expect(fillEvenly(r(1e6, 1e6, 1e6), 10_000)).toEqual(r(3334, 3333, 3333));
    expect(fillEvenly(r(1e6, 100, 1e6), 10_000)).toEqual(r(4950, 100, 4950));
    expect(fillEvenly(r(10, 20, 30), 10_000)).toEqual(r(10, 20, 30));
    expect(fillEvenly(r(5, 5, 5), 0)).toEqual(r(0, 0, 0));
    // The cargo keeps the order of the fields, whatever resource is filled first.
    expect(Object.keys(fillEvenly(r(30, 10, 20), 60))).toEqual(['m', 'c', 'd']);
  });

  it('never loads more than the room or a stock', () => {
    const stock = fc.record({
      m: fc.nat(1e7),
      c: fc.nat(1e7),
      d: fc.nat(1e7),
    });
    fc.assert(
      fc.property(stock, fc.nat(1e7), (s, room) => {
        const out = fillEvenly(s, room);
        expect(out.m + out.c + out.d).toBe(Math.min(room, s.m + s.c + s.d));
        for (const k of ['m', 'c', 'd'] as const)
          expect(out[k]).toBeLessThanOrEqual(s[k]);
      }),
      { seed: 407 },
    );
  });
});

describe('the „alles“ of one field (#240)', () => {
  it('fills up to the room the other fields leave, at most its stock, never below 0', () => {
    expect(fillOne(r(500, 500, 500), 1000, r(300, 0, 200), 'c')).toBe(500);
    expect(fillOne(r(500, 900, 500), 1000, r(300, 0, 200), 'c')).toBe(500);
    expect(fillOne(r(500, 900, 500), 1000, r(300, 50, 200), 'c')).toBe(500);
    expect(fillOne(r(500, 900, 500), 400, r(300, 0, 200), 'c')).toBe(0);
  });
});

describe('the intent of the buttons (#407)', () => {
  it('is „even“ or the fields in the order of the clicks, nothing else', () => {
    expect(cargoIntentOf('even')).toBe('even');
    expect(cargoIntentOf(['d', 'm'])).toEqual(['d', 'm']);
    for (const bad of [
      undefined,
      null,
      'all',
      [],
      ['x'],
      ['m', 'm'],
      ['m', 'x'],
      [1],
      { 0: 'm' },
    ])
      expect(cargoIntentOf(bad)).toBeNull();
  });

  it('computes its fields on the stock and room given, the typed ones as typed, in the order of the clicks', () => {
    const stock = r(10_000, 10_000, 10_000);
    expect(resolveCargo(stock, 9000, r(1, 2, 3), 'even')).toEqual(
      r(3000, 3000, 3000),
    );
    expect(resolveCargo(stock, 9000, r(1000, 2, 3), null)).toEqual(
      r(1000, 2, 3),
    );
    // Promethium first takes what Adamant typed leaves, then Psikristall the rest.
    expect(resolveCargo(stock, 9000, r(1000, 0, 0), ['d', 'c'])).toEqual(
      r(1000, 0, 8000),
    );
    expect(resolveCargo(stock, 9000, r(1000, 0, 0), ['c', 'd'])).toEqual(
      r(1000, 8000, 0),
    );
    expect(
      resolveCargo(r(100, 10_000, 10_000), 9000, r(0, 0, 0), ['m', 'c']),
    ).toEqual(r(100, 8900, 0));
  });

  it('follows the clicks: the even fill becomes numbers, a field asked again goes last', () => {
    expect(askOne(null, 'm')).toEqual(['m']);
    expect(askOne('even', 'c')).toEqual(['c']);
    expect(askOne(['m', 'c'], 'm')).toEqual(['c', 'm']);
    expect(askOne(['m'], 'd')).toEqual(['m', 'd']);
  });

  it('forgets a field typed by hand, and the even fill as a whole', () => {
    expect(typedCargo(['m', 'c'], 'm')).toEqual(['c']);
    expect(typedCargo(['m'], 'm')).toBeNull();
    expect(typedCargo(['m'], 'c')).toEqual(['m']);
    expect(typedCargo('even', 'd')).toBeNull();
    expect(typedCargo(null, 'd')).toBeNull();
  });
});

describe('what a planet can load (#407)', () => {
  it('is whole units, Promethium after the fuel, never below 0', () => {
    expect(loadableStock({ m: 10.9, c: 3.2, d: 100.7 }, 30)).toEqual({
      m: 10,
      c: 3,
      d: 70,
    });
    expect(loadableStock({ m: 0, c: 0, d: 20 }, 30)).toEqual({
      m: 0,
      c: 0,
      d: 0,
    });
  });
});
