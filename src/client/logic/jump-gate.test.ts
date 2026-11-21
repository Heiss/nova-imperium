// The Warp-Tor in the fleet view (#230): the box only on a moon with a
// Warp-Tor, the other own moons with one as „Zielmond“, and „Springen“ only
// while both gates are ready, as the server checks it.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { GateView } from '../../core/jump-gate.ts';
import { jumpPanel, viewDue } from './jump-gate.ts';
import type { Planet } from '../../core/types.ts';
import type { GalaxyPlanet } from './types.ts';

const NOW = 1_800_000_000_000;

const here = (over: Partial<Planet> = {}): Planet =>
  ({
    id: 'm1_2_3',
    kind: 'moon',
    owner: 'u_Anna',
    name: 'Mond',
    g: 1,
    s: 2,
    p: 3,
    b: { moonbase: 1, jumpgate: 2 },
    ships: { lc: 3 },
    bq: null,
    sq: [],
    sqT: null,
    ...over,
  }) as Planet;

const place = (id: string, over: Partial<GalaxyPlanet> = {}): GalaxyPlanet => {
  const [g, s, p] = id.slice(1).split('_').map(Number) as [
    number,
    number,
    number,
  ];
  return {
    id,
    kind: id.startsWith('m') ? 'moon' : 'planet',
    name: 'Luna',
    g,
    s,
    p,
    temp: 0,
    owner: 'u_Anna',
    ...over,
  };
};

const galaxy = [
  place('p1_2_3', { name: 'Heimat' }),
  place('m1_2_3', { name: 'Mond' }),
  place('m2_5_9', { name: 'Luna' }),
  place('m3_1_1', { name: 'Selene' }),
  place('m1_7_7', { name: 'Fremd', owner: 'u_Bert' }),
];

const gates = (...over: Partial<GateView>[]): GateView[] => [
  { id: 'm1_2_3', level: 2, ready: 0, ...over[0] },
  { id: 'm2_5_9', level: 1, ready: 0, ...over[1] },
  { id: 'm3_1_1', level: 4, ready: 0, ...over[2] },
];

describe('the box „Warp-Tor“', () => {
  it('is shown only on a moon with a Warp-Tor', () => {
    const s = { gates: gates(), galaxy };
    expect(jumpPanel(s, here({ b: { moonbase: 1 } }), NOW)).toBeNull();
    expect(
      jumpPanel(s, here({ kind: 'planet', id: 'p1_2_3' }), NOW),
    ).toBeNull();
    expect(jumpPanel(s, here(), NOW)).not.toBeNull();
  });

  it('is shown from level 1 on', () => {
    const panel = jumpPanel(
      { gates: gates({ level: 1 }), galaxy },
      here({ b: { moonbase: 1, jumpgate: 1 } }),
      NOW,
    );
    expect(panel?.targets).toHaveLength(2);
  });

  it('reads the readiness of the gate of this moon, not of the first gate', () => {
    const cooling = gates({}, { ready: NOW + 60_000 });
    const panel = jumpPanel(
      { gates: [cooling[1]!, cooling[0]!, cooling[2]!], galaxy },
      here(),
      NOW,
    )!;
    expect(panel.cooling).toBeNull();
    expect(panel.canJump).toBe(true);
  });

  it('offers the other own moons with a Warp-Tor as „Zielmond“', () => {
    expect(jumpPanel({ gates: gates(), galaxy }, here(), NOW)).toEqual({
      cooling: null,
      targets: [
        { id: 'm2_5_9', label: 'Luna (Mond) [2:5:9]', disabled: false },
        { id: 'm3_1_1', label: 'Selene (Mond) [3:1:1]', disabled: false },
      ],
      canJump: true,
    });
  });

  it('marks a cooling target with „Wieder bereit in …“ and disables it', () => {
    const panel = jumpPanel(
      { gates: gates({}, { ready: NOW + 90_000 }), galaxy },
      here(),
      NOW,
    )!;
    expect(panel.targets[0]).toEqual({
      id: 'm2_5_9',
      label: 'Luna (Mond) [2:5:9] – Wieder bereit in 1m 30s',
      disabled: true,
    });
    expect(panel.canJump).toBe(true);
    const all = jumpPanel(
      {
        gates: gates({}, { ready: NOW + 1 }, { ready: NOW + 1 }),
        galaxy,
      },
      here(),
      NOW,
    )!;
    expect(all.targets.map((t) => t.disabled)).toEqual([true, true]);
    expect(all.canJump).toBe(false);
  });

  it('says when its own gate is ready again and offers no jump until then', () => {
    const panel = jumpPanel(
      { gates: gates({ ready: NOW + 5 }), galaxy },
      here(),
      NOW,
    )!;
    expect(panel.cooling).toBe(NOW + 5);
    expect(panel.canJump).toBe(false);
    expect(
      jumpPanel({ gates: gates({ ready: NOW }), galaxy }, here(), NOW)!,
    ).toMatchObject({ cooling: null, canJump: true });
  });

  it('has no target without another gate, nor for foreign or missing moons', () => {
    const lone = jumpPanel(
      { gates: [{ id: 'm1_2_3', level: 2, ready: 0 }], galaxy },
      here(),
      NOW,
    );
    expect(lone).toEqual({ cooling: null, targets: [], canJump: false });
    // A moon that is gone (#95) and a foreign one are no targets.
    const odd = jumpPanel(
      {
        gates: [
          { id: 'm9_9_9', level: 1, ready: 0 },
          { id: 'm1_7_7', level: 1, ready: 0 },
          { id: 'm2_5_9', level: 0, ready: 0 },
        ],
        galaxy,
      },
      here(),
      NOW,
    );
    expect(odd!.targets).toEqual([]);
    // Without gates in the state the own gate is ready.
    expect(jumpPanel({ galaxy }, here(), NOW)).toEqual({
      cooling: null,
      targets: [],
      canJump: false,
    });
  });

  it('offers „Springen“ exactly when both gates of some target are ready (property)', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 100 }), {
          minLength: 3,
          maxLength: 3,
        }),
        fc.integer({ min: 0, max: 100 }),
        ([a, b, c], now) => {
          const panel = jumpPanel(
            {
              gates: gates({ ready: a! }, { ready: b! }, { ready: c! }),
              galaxy,
            },
            here(),
            now,
          )!;
          expect(panel.canJump).toBe(a! <= now && (b! <= now || c! <= now));
          expect(panel.cooling).toBe(a! <= now ? null : a);
        },
      ),
    );
  });
});

describe('the clock draws the view again', () => {
  const shown = (over: Partial<Planet> = {}, list = gates()) => ({
    s: { gates: list },
    P: here(over),
    R: { rq: null },
    now: NOW,
  });

  it('not while nothing ends', () => {
    expect(viewDue(shown(), NOW + 1000)).toBe(false);
    expect(viewDue({ ...shown(), s: {} }, NOW + 1000)).toBe(false);
  });

  it('when a building, the research or a ship of the place is done', () => {
    const bq = {
      key: 'jumpgate',
      lvl: 3,
      start: NOW,
      end: NOW + 500,
      cost: [0, 0, 0],
    } as Planet['bq'];
    expect(viewDue(shown({ bq }), NOW + 499)).toBe(false);
    expect(viewDue(shown({ bq }), NOW + 500)).toBe(true);
    const rq = { end: NOW + 500 } as NonNullable<Planet['bq']>;
    expect(viewDue({ ...shown(), R: { rq } }, NOW + 499)).toBe(false);
    expect(viewDue({ ...shown(), R: { rq } }, NOW + 500)).toBe(true);
    const sq = [{ key: 'lf', n: 2, unit: 300 }];
    expect(viewDue(shown({ sq, sqT: NOW }), NOW + 299)).toBe(false);
    expect(viewDue(shown({ sq, sqT: NOW }), NOW + 300)).toBe(true);
    // A queue that has not started yet starts now.
    expect(viewDue(shown({ sq, sqT: null }), NOW + 299)).toBe(false);
    expect(viewDue(shown({ sq: [{ ...sq[0]!, unit: 0 }] }), NOW)).toBe(true);
  });

  it('once when a Warp-Tor turns ready, the own one or a target', () => {
    for (const cooling of [
      gates({ ready: NOW + 2000 }),
      gates({}, {}, { ready: NOW + 2000 }),
    ]) {
      const v = shown({}, cooling);
      expect(viewDue(v, NOW + 1999)).toBe(false);
      expect(viewDue(v, NOW + 2000)).toBe(true);
      expect(viewDue(v, NOW + 9000)).toBe(true);
      // The redraw moves the view to the readiness: not again after it.
      expect(viewDue({ ...v, now: NOW + 2000 }, NOW + 3000)).toBe(false);
      expect(viewDue({ ...v, now: NOW + 1999 }, NOW + 3000)).toBe(true);
    }
  });

  it('not for a Warp-Tor on a place without one', () => {
    const cooling = gates({}, { ready: NOW + 2000 });
    const planet = shown({ b: { moonbase: 1 } }, cooling);
    expect(viewDue(planet, NOW + 2000)).toBe(false);
  });
});
