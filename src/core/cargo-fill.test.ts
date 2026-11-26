// The cargo buttons as one rule for the browser and the server (#240, #407).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  askOne,
  type CargoIntent,
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
  it('is „even“ or the one field of the newest „alles“, nothing else (159b)', () => {
    expect(cargoIntentOf('even')).toBe('even');
    for (const k of ['m', 'c', 'd']) expect(cargoIntentOf([k])).toEqual([k]);
    for (const bad of [
      undefined,
      null,
      'all',
      'm',
      [],
      ['x'],
      ['d', 'm'],
      ['m', 'm'],
      ['m', 'x'],
      [1],
      { 0: 'm' },
    ])
      expect(cargoIntentOf(bad)).toBeNull();
  });

  it('computes its field on the stock and room given, up to the room the other fields leave, the others as they are', () => {
    const stock = r(10_000, 10_000, 10_000);
    expect(resolveCargo(stock, 9000, r(1, 2, 3), 'even')).toEqual(
      r(3000, 3000, 3000),
    );
    expect(resolveCargo(stock, 9000, r(1000, 2, 3), null)).toEqual(
      r(1000, 2, 3),
    );
    expect(resolveCargo(stock, 9000, r(1000, 0, 0), ['d'])).toEqual(
      r(1000, 0, 8000),
    );
    // An earlier „alles“ is a number now and takes its room as shown.
    expect(resolveCargo(stock, 9000, r(1000, 6000, 0), ['d'])).toEqual(
      r(1000, 6000, 2000),
    );
    expect(
      resolveCargo(r(100, 10_000, 10_000), 9000, r(0, 0, 0), ['m']),
    ).toEqual(r(100, 0, 0));
  });

  it('does not count what its field held before, so a second computation changes nothing (CodeRabbit on #421)', () => {
    // The example of the review: old numbers in Adamant and Psikristall.
    const stock = r(10_000, 100, 0);
    const shown = r(1000, 8000, 0);
    // „alles“ under Psikristall: Adamant stays the number it showed.
    const first = resolveCargo(stock, 9000, shown, ['c']);
    expect(first).toEqual(r(1000, 100, 0));
    expect(resolveCargo(stock, 9000, first, ['c'])).toEqual(first);
    // What Psikristall held does not matter.
    expect(resolveCargo(stock, 9000, r(1000, 0, 0), ['c'])).toEqual(first);
    expect(resolveCargo(stock, 9000, r(1000, 9000, 0), ['c'])).toEqual(first);
    // „alles“ under Adamant after it: Psikristall keeps its 100.
    const second = resolveCargo(stock, 9000, first, ['m']);
    expect(second).toEqual(r(8900, 100, 0));
    expect(resolveCargo(stock, 9000, second, ['m'])).toEqual(second);
  });

  it('is the same however often it is computed, and keeps the fields outside the intent', () => {
    const res = fc.record({
      m: fc.nat(30_000),
      c: fc.nat(30_000),
      d: fc.nat(30_000),
    });
    const intent = fc.oneof(
      fc.constant(null),
      fc.constant('even' as const),
      fc.constantFrom<CargoIntent>(['m'], ['c'], ['d']),
    );
    fc.assert(
      fc.property(res, fc.nat(40_000), res, intent, (stock, room, typed, i) => {
        const once = resolveCargo(stock, room, typed, i);
        expect(resolveCargo(stock, room, once, i)).toEqual(once);
        if (i !== 'even')
          for (const k of ['m', 'c', 'd'] as const)
            if (i?.[0] !== k) expect(once[k]).toBe(typed[k]);
      }),
      { seed: 421, numRuns: 500 },
    );
  });

  it('follows the clicks: only the newest „alles“ stays computed (159b)', () => {
    expect(askOne('m')).toEqual(['m']);
    expect(askOne('d')).toEqual(['d']);
  });

  it('forgets a field typed by hand, and the even fill as a whole', () => {
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
