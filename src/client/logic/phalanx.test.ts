// The Auspex-Phalanx on the Sternenkarte (#53, owner, 2026-11-15): when the
// scan is offered, what the answer of the server must hold, and the rows of
// the panel.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { text } from '../../core/text.ts';
import type { Planet } from '../../core/types.ts';
import {
  canScan,
  placeText,
  type Scan,
  scanOf,
  scanRows,
  scanTitle,
  shipsText,
} from './phalanx.ts';
import type { GalaxyPlanet } from './types.ts';

const moon = (over: Partial<Planet> = {}): Planet =>
  ({
    id: 'm1_5_4',
    kind: 'moon',
    owner: 'u_Anna',
    g: 1,
    s: 5,
    p: 4,
    b: { moonbase: 1, phalanx: 2 },
    res: { m: 0, c: 0, d: 0 },
    ...over,
  }) as Planet;

const row = (over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => ({
  id: 'p1_7_7',
  kind: 'planet',
  name: 'Beta',
  g: 1,
  s: 7,
  p: 7,
  temp: 20,
  owner: 'u_Bert',
  ...over,
});

describe('the scan on the Sternenkarte', () => {
  it('is offered from a moon with a phalanx at a foreign planet in range', () => {
    expect(canScan(moon(), row())).toBe(true);
    // Also without the Promethium: the server names the price.
    expect(canScan(moon({ res: { m: 0, c: 0, d: 0 } }), row())).toBe(true);
  });

  it('is not offered from a planet or a moon without phalanx', () => {
    expect(canScan(moon({ kind: 'planet' }), row())).toBe(false);
    expect(canScan(moon({ b: { moonbase: 1 } }), row())).toBe(false);
  });

  it('is not offered at a moon, an own planet or out of range', () => {
    expect(canScan(moon(), row({ id: 'm1_7_7', kind: 'moon' }))).toBe(false);
    expect(canScan(moon(), row({ owner: 'u_Anna' }))).toBe(false);
    expect(canScan(moon(), row({ s: 9 }))).toBe(false);
    expect(canScan(moon(), row({ g: 2, s: 5 }))).toBe(false);
  });

  it('is offered exactly in level² − 1 systems of the own galaxy (property)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 1, max: 2 }),
        fc.integer({ min: 1, max: 40 }),
        (level, g, s) => {
          const here = moon({ b: { moonbase: 1, phalanx: level } });
          expect(canScan(here, row({ g, s }))).toBe(
            level > 0 && g === 1 && Math.abs(s - 5) <= level * level - 1,
          );
        },
      ),
    );
  });
});

const SCAN: Scan = {
  by: 'm1_5_4',
  target: 'p1_7_7',
  flights: [
    { ships: { lc: 10, sc: 0, lf: 3 }, from: 'p1_9_9', to: 'p1_7_7', arr: 5 },
    { ships: { probe: 1 }, from: 'p1_7_7', to: 'm1_9_9', arr: 9 },
  ],
};

describe('the answer of a scan', () => {
  it('is read from the data of the answer', () => {
    expect(scanOf({ scan: SCAN })).toEqual(SCAN);
    expect(scanOf({ scan: { ...SCAN, flights: [] } })!.flights).toEqual([]);
  });

  it('is nothing for other data or a broken scan', () => {
    const flight = SCAN.flights[0]!;
    for (const data of [
      null,
      'scan',
      {},
      { scan: null },
      { scan: 'x' },
      { scan: { ...SCAN, by: 1 } },
      { scan: { ...SCAN, target: null } },
      { scan: { ...SCAN, flights: 'none' } },
      { scan: { ...SCAN, flights: [null] } },
      { scan: { ...SCAN, flights: [{ ...flight, ships: null }] } },
      { scan: { ...SCAN, flights: [{ ...flight, ships: 'lc' }] } },
      { scan: { ...SCAN, flights: [{ ...flight, from: 1 }] } },
      { scan: { ...SCAN, flights: [{ ...flight, to: 1 }] } },
      { scan: { ...SCAN, flights: [{ ...flight, arr: '5' }] } },
      { scan: { ...SCAN, flights: [flight, { ...flight, arr: '5' }] } },
    ])
      expect(scanOf(data), JSON.stringify(data)).toBeNull();
  });

  it('keeps only the fields of a scan', () => {
    expect(Object.keys(scanOf({ scan: { ...SCAN, extra: 1 } })!)).toEqual([
      'by',
      'target',
      'flights',
    ]);
  });
});

describe('the rows of the panel', () => {
  it('name the ships, the origin, the target and the arrival of each flight', () => {
    expect(scanRows(SCAN)).toEqual([
      {
        ships: `10 ${text('lc')!.n}, 3 ${text('lf')!.n}`,
        from: '[1:9:9]',
        to: '[1:7:7]',
        arr: 5,
      },
      {
        ships: `1 ${text('probe')!.n}`,
        from: '[1:7:7]',
        to: '[1:9:9] (Mond)',
        arr: 9,
      },
    ]);
  });

  it('name an unknown ship by its key and an unknown place as „[?]“', () => {
    expect(shipsText({ zz: 1000 })).toBe('1.000 zz');
    expect(shipsText({})).toBe('');
    expect(placeText('x')).toBe('[?]');
    expect(placeText('d1_2_3')).toBe('[1:2:3]');
  });

  it('are headed by the name of the planet when the Sternenkarte knows it', () => {
    expect(scanTitle(SCAN, [row()])).toBe('Phalanx-Scan: Beta [1:7:7]');
    expect(scanTitle(SCAN, [row({ id: 'p1_7_8' })])).toBe(
      'Phalanx-Scan: [1:7:7]',
    );
  });
});
