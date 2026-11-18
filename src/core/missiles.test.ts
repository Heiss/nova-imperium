// The missiles (#54, okf/features/missiles.md): range, flight time, the
// checks of a launch and the impact, with the examples of owiki
// („Interplanetarrakete“: one missile destroys 60 Raketenwerfer or 3
// Gaußkanonen at equal research).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DEF } from './catalog.ts';
import {
  INTERCEPTORS,
  inMissileRange,
  isTarget,
  type LaunchError,
  type Launcher,
  type LaunchTarget,
  launchError,
  missileFlightMs,
  missileRange,
  STRIKER,
  strike,
  TARGETS,
} from './missiles.ts';

const NONE = { weapons: 0, armor: 0 };

describe('missiles: what is launched, what intercepts, what is hit', () => {
  it('launches the Orbitalrakete, intercepts with the Abfangrakete, hits the defense that fights', () => {
    expect(STRIKER).toBe('ipm');
    expect(INTERCEPTORS).toEqual(['abm']);
    expect(TARGETS).toEqual([
      'rl',
      'll',
      'hl',
      'gauss',
      'ionc',
      'pt',
      'ssd',
      'lsd',
    ]);
    for (const k of ['abm', 'ipm', 'lf', 'metal', 'nope', 'constructor'])
      expect(isTarget(k), k).toBe(false);
    for (const k of TARGETS) expect(isTarget(k), k).toBe(true);
  });
});

describe('missiles: range and flight time', () => {
  it('reaches impulse level × 5 − 1 systems, nothing without the drive', () => {
    expect(missileRange(0)).toBe(-1);
    expect(missileRange(1)).toBe(4);
    expect(missileRange(3)).toBe(14);
  });

  it('reaches only its own galaxy, without a wrap around its end', () => {
    const at = { g: 2, s: 10, p: 5 };
    expect(inMissileRange(at, { g: 2, s: 10, p: 1 }, 1)).toBe(true);
    expect(inMissileRange(at, { g: 2, s: 14, p: 1 }, 1)).toBe(true);
    expect(inMissileRange(at, { g: 2, s: 6, p: 1 }, 1)).toBe(true);
    expect(inMissileRange(at, { g: 2, s: 15, p: 1 }, 1)).toBe(false);
    expect(inMissileRange(at, { g: 2, s: 5, p: 1 }, 1)).toBe(false);
    expect(inMissileRange(at, { g: 1, s: 10, p: 5 }, 9)).toBe(false);
    expect(inMissileRange(at, { g: 2, s: 10, p: 5 }, 0)).toBe(false);
  });

  it('flies (30 + 60 × systems) / universe speed seconds', () => {
    const at = { g: 1, s: 10, p: 5 };
    expect(missileFlightMs(at, { g: 1, s: 10, p: 1 }, 1)).toBe(30_000);
    expect(missileFlightMs(at, { g: 1, s: 14, p: 1 }, 1)).toBe(270_000);
    expect(missileFlightMs(at, { g: 1, s: 6, p: 1 }, 2)).toBe(135_000);
  });
});

describe('missiles: the checks of a launch', () => {
  const launcher = (ipm: number, impulse = 1): Launcher => ({
    at: { id: 'p1_1_5', owner: 'a', def: { ipm }, g: 1, s: 1, p: 5 },
    impulse,
  });
  const target = (
    over: Partial<LaunchTarget> = {},
    protects = false,
  ): LaunchTarget => ({
    place: { kind: 'planet', g: 1, s: 3, p: 6 },
    owner: 'b',
    protects: () => protects,
    vacation: () => false,
    ...over,
  });

  it('launches a whole number of missiles the planet has at a foreign place in range', () => {
    expect(launchError(launcher(5), target(), 5, null)).toBeNull();
    expect(launchError(launcher(5), target(), 1, 'gauss')).toBeNull();
    const moon = target({ place: { kind: 'moon', g: 1, s: 5, p: 6 } });
    expect(launchError(launcher(1), moon, 1, null)).toBeNull();
  });

  it('names the first reason, in the order of the checks', () => {
    const cases: [
      LaunchError,
      Launcher,
      LaunchTarget,
      number,
      string | null,
    ][] = [
      ['count', launcher(5), target(), 0, null],
      ['count', launcher(5), target(), 1.5, null],
      ['count', launcher(5), target(), -1, 'nope'],
      ['noMissiles', launcher(2), target(), 3, null],
      ['noMissiles', launcher(0), target({ owner: undefined }), 1, null],
      ['aim', launcher(2), target(), 1, 'abm'],
      ['aim', launcher(2), target(), 1, 'constructor'],
      ['noPlanet', launcher(2), target({ owner: undefined }), 1, null],
      [
        'noMoon',
        launcher(2),
        target({
          owner: undefined,
          place: { kind: 'moon', g: 1, s: 3, p: 6 },
        }),
        1,
        null,
      ],
      ['ownTarget', launcher(2, 0), target({ owner: 'a' }), 1, null],
      ['outOfRange', launcher(2, 0), target({}, true), 1, null],
      [
        'outOfRange',
        launcher(2, 9),
        target({ place: { kind: 'planet', g: 2, s: 1, p: 5 } }),
        1,
        null,
      ],
      // The vacation mode of the owner comes before the noob protection (#223).
      [
        'vacation',
        launcher(2),
        target({ vacation: (o) => o === 'b' }, true),
        1,
        null,
      ],
      ['protected', launcher(2), target({}, true), 1, null],
    ];
    for (const [code, l, t, n, aim] of cases)
      expect(launchError(l, t, n, aim), code).toBe(code);
  });

  it('asks the protection only of a foreign target in range', () => {
    const asked: string[] = [];
    const t = (over: Partial<LaunchTarget>): LaunchTarget => ({
      ...target(over),
      protects: (o) => {
        asked.push(o);
        return false;
      },
    });
    launchError(launcher(2), t({ owner: 'a' }), 1, null);
    launchError(launcher(2, 0), t({}), 1, null);
    launchError(launcher(0), t({}), 1, null);
    expect(asked).toEqual([]);
    launchError(launcher(2), t({}), 1, null);
    expect(asked).toEqual(['b']);
  });

  it('asks the vacation of the owner of a foreign target in range only, and an own or a far one is no vacation case (#223)', () => {
    const asked: string[] = [];
    const t = (over: Partial<LaunchTarget>): LaunchTarget => ({
      ...target(over),
      vacation: (o) => {
        asked.push(o);
        return false;
      },
    });
    launchError(launcher(2), t({ owner: 'a' }), 1, null);
    launchError(launcher(2, 0), t({}), 1, null);
    launchError(launcher(0), t({}), 1, null);
    launchError(launcher(2), t({ owner: undefined }), 1, null);
    expect(asked).toEqual([]);
    launchError(launcher(2), t({}), 1, null);
    expect(asked).toEqual(['b']);
    // Only the owner of the target counts, not the launcher.
    expect(
      launchError(launcher(2), target({ vacation: (o) => o === 'a' }), 1, null),
    ).toBeNull();
  });
});

describe('missiles: the impact', () => {
  it('destroys 60 Raketenbatterien or 3 Massebeschleuniger with one missile at equal research (owiki)', () => {
    const t = (def: Record<string, number>) => ({ def, interceptors: {} });
    expect(strike(1, t({ rl: 100 }), null, NONE).destroyed).toEqual({
      rl: 60,
    });
    expect(strike(1, t({ gauss: 10 }), null, NONE).destroyed).toEqual({
      gauss: 3,
    });
    expect(strike(1, t({ hl: 20 }), null, NONE).destroyed).toEqual({ hl: 15 });
    // The same with both research at 1: the bonuses cancel out.
    const even = { weapons: 1, armor: 1 };
    expect(strike(1, t({ rl: 100 }), null, even).destroyed).toEqual({
      rl: 60,
    });
    expect(strike(10, t({ rl: 1000 }), null, { weapons: 3, armor: 3 })).toEqual(
      { intercepted: 0, used: {}, destroyed: { rl: 600 } },
    );
  });

  it('grows with the weapons of the attacker and shrinks with the armor of the defender', () => {
    const t = { def: { rl: 1000 }, interceptors: {} };
    expect(strike(1, t, null, { weapons: 2, armor: 0 }).destroyed).toEqual({
      rl: 72,
    });
    expect(strike(1, t, null, { weapons: 0, armor: 2 }).destroyed).toEqual({
      rl: 50,
    });
  });

  it('ignores shields: a dome falls to the structure alone', () => {
    // Großer Schutzdom: structure 100,000, hull 10,000, shield 10,000; the
    // rest of 2,000 takes 10 Raketenbatterien.
    const t = { def: { rl: 100, lsd: 1 }, interceptors: {} };
    expect(strike(1, t, 'lsd', NONE).destroyed).toEqual({ lsd: 1, rl: 10 });
    expect(strike(1, t, null, NONE).destroyed).toEqual({ rl: 60 });
  });

  it('stops one missile with each Abfangrakete first', () => {
    const t = { def: { rl: 1000 }, interceptors: { abm: 2 } };
    expect(strike(3, t, null, NONE)).toEqual({
      intercepted: 2,
      used: { abm: 2 },
      destroyed: { rl: 60 },
    });
    expect(strike(2, t, null, NONE)).toEqual({
      intercepted: 2,
      used: { abm: 2 },
      destroyed: {},
    });
    expect(strike(1, { ...t, interceptors: { abm: 5 } }, null, NONE)).toEqual({
      intercepted: 1,
      used: { abm: 1 },
      destroyed: {},
    });
  });

  it('hits the main target first, then the defense in the order of the catalog (D3)', () => {
    const def = { rl: 100, ll: 100, gauss: 10 };
    const t = { def, interceptors: {} };
    // 12,000: 3 Massebeschleuniger (10,500), the rest of 1,500 takes 7
    // Raketenbatterien (1,400); 100 is left, too little for a Lichtlanze.
    expect(strike(1, t, 'gauss', NONE).destroyed).toEqual({ gauss: 3, rl: 7 });
    // Without a main target: the catalog order, Raketenbatterien first.
    expect(strike(2, t, null, NONE).destroyed).toEqual({ rl: 100, ll: 20 });
    // A main target the planet does not have: the catalog order.
    expect(strike(1, t, 'pt', NONE).destroyed).toEqual({ rl: 60 });
    // An unknown main target or a missile: the catalog order.
    expect(strike(1, t, 'abm', NONE).destroyed).toEqual({ rl: 60 });
    expect(strike(1, t, 'nope', NONE).destroyed).toEqual({ rl: 60 });
  });

  it('never hits ships or unknown entries', () => {
    const t = { def: { lf: 10, nope: 10 }, interceptors: {} };
    expect(strike(5, t, null, NONE).destroyed).toEqual({});
  });

  it('hits the stored missiles once no defense is left (owner, 2026-11-17)', () => {
    // 2 missiles: 24,000. 10 Raketenbatterien take 2,000; the rest of
    // 22,000 takes 10 Abfangraketen (structure 800 each, 8,000) and then
    // 9 Orbitalraketen (1,500 each, 13,500).
    const t = { def: { rl: 10, abm: 10, ipm: 20 }, interceptors: {} };
    expect(strike(2, t, null, NONE).destroyed).toEqual({
      rl: 10,
      abm: 10,
      ipm: 9,
    });
    // While a defense stands, the missiles stay: 1 Massebeschleuniger is
    // too much for the rest of 2,000 after 50 Raketenbatterien.
    const standing = {
      def: { rl: 50, gauss: 1, abm: 10 },
      interceptors: {},
    };
    expect(strike(1, standing, 'rl', NONE).destroyed).toEqual({ rl: 50 });
    // An own Abfangrakete that intercepted is no longer there to be hit.
    const own = {
      def: { abm: 3, ipm: 4 },
      interceptors: { abm: 3 },
      own: true,
    };
    expect(strike(4, own, null, NONE)).toEqual({
      intercepted: 3,
      used: { abm: 3 },
      destroyed: { ipm: 4 },
    });
    // At a moon the Abfangraketen stand on the planet: the moon has none.
    const moon = { def: { abm: 0 }, interceptors: { abm: 3 }, own: false };
    expect(strike(4, moon, null, NONE).destroyed).toEqual({});
  });

  it('destroys no more than there is and no more than the damage covers, on generated cases', () => {
    const counts = fc.dictionary(
      fc.constantFrom(...TARGETS, 'abm', 'ipm', 'nope'),
      fc.integer({ min: 0, max: 500 }),
    );
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 40 }),
        counts,
        fc.integer({ min: 0, max: 40 }),
        fc.option(fc.constantFrom(...TARGETS, 'abm', 'nope'), { nil: null }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 20 }),
        (n, def, abm, aim, weapons, armor) => {
          const s = strike(n, { def, interceptors: { abm } }, aim, {
            weapons,
            armor,
          });
          expect(s.intercepted).toBe(Math.min(n, abm));
          expect(s.used).toEqual(s.intercepted ? { abm: s.intercepted } : {});
          let used = 0;
          for (const [k, x] of Object.entries(s.destroyed)) {
            expect(isTarget(k) || k === 'abm' || k === 'ipm', k).toBe(true);
            expect(x).toBeGreaterThan(0);
            expect(x).toBeLessThanOrEqual(def[k] ?? 0);
            const c = DEF[k]!.cost;
            used += x * ((c[0] + c[1]) / 10) * (1 + 0.1 * armor);
          }
          const damage =
            (n - s.intercepted) * DEF[STRIKER]!.atk * (1 + 0.1 * weapons);
          expect(used).toBeLessThanOrEqual(damage * (1 + 1e-9));
        },
      ),
      { seed: 54, numRuns: 300 },
    );
  });
});
