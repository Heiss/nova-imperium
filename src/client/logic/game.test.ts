import { describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import {
  buildState,
  cargoMax,
  fleetEnd,
  fleetPreview,
  galaxyStep,
  isProtected,
  nameOf,
  newestFirst,
  ranks,
  researchState,
  settingsFrom,
  sortFleets,
  unread,
} from './game.ts';
import type { ClientFleet, Report } from './types.ts';

const players = {
  a: { name: 'Anna', points: 50 },
  b: { name: 'Bert', points: 9 },
  c: { name: 'Cleo', points: 10 },
};

describe('players', () => {
  it('rank by points', () => {
    expect(ranks(players)).toEqual({ a: 1, c: 2, b: 3 });
  });
  it('protect players below a fifth of my points', () => {
    expect(isProtected(players, 'a', 'b')).toBe(true);
    expect(isProtected(players, 'a', 'c')).toBe(false);
    expect(isProtected(players, 'b', 'a')).toBe(false);
    expect(isProtected(players, 'a', 'x')).toBe(true);
    expect(isProtected(players, 'x', 'b')).toBe(false);
  });
  it('name players', () => {
    expect(nameOf(players, 'a')).toBe('Anna');
    expect(nameOf(players, 'x')).toBe('Unbekannt');
  });
});

describe('fleets', () => {
  const f = (
    id: string,
    state: 'out' | 'back',
    arr: number,
    ret?: number,
  ): ClientFleet =>
    ({
      id,
      owner: 'a',
      state,
      arr,
      ret,
      mission: 'attack',
      ships: {},
      fromC: { g: 1, s: 1, p: 1 },
      toC: { g: 1, s: 1, p: 2 },
      to: 'x',
    }) as ClientFleet;
  it('sort by the next event', () => {
    expect(fleetEnd(f('1', 'out', 5, 9))).toBe(5);
    expect(fleetEnd(f('1', 'back', 5, 9))).toBe(9);
    expect(fleetEnd(f('1', 'back', 5))).toBe(5);
    expect(
      sortFleets([
        f('1', 'out', 30),
        f('2', 'back', 1, 20),
        f('3', 'out', 10),
      ]).map((x) => x.id),
    ).toEqual(['3', '2', '1']);
  });
});

describe('button states', () => {
  const r = { research: {}, rq: null };
  it('of buildings', () => {
    const busy = planet({
      bq: { key: 'metal', lvl: 1, start: 0, end: 9, cost: [0, 0, 0] },
    });
    expect(buildState(busy, r, 'metal', 0)).toBe('running');
    expect(buildState(busy, r, 'crystal', 1)).toBe('missing');
    expect(buildState(busy, r, 'crystal', 0)).toBe('queueBusy');
    expect(
      buildState(planet({ sq: [{ key: 'lf', n: 1, unit: 1 }] }), r, 'yard', 0),
    ).toBe('yardBusy');
    expect(
      buildState(
        planet({ sq: [{ key: 'lf', n: 1, unit: 1 }] }),
        r,
        'nanite',
        0,
      ),
    ).toBe('yardBusy');
    expect(
      buildState(
        planet(),
        {
          research: {},
          rq: { key: 'energy', lvl: 1, start: 0, end: 1, cost: [0, 0, 0] },
        },
        'lab',
        0,
      ),
    ).toBe('labBusy');
    expect(buildState(planet(), r, 'lab', 0)).toBe('ready');
    expect(buildState(planet(), r, 'yard', 0)).toBe('ready');
  });
  it('of buildings on a full planet or without energy (#51)', () => {
    const busy = planet({
      bq: { key: 'metal', lvl: 1, start: 0, end: 9, cost: [0, 0, 0] },
    });
    expect(buildState(busy, r, 'metal', 0, true)).toBe('running');
    expect(buildState(busy, r, 'crystal', 1, true)).toBe('missing');
    expect(buildState(busy, r, 'crystal', 0, true)).toBe('full');
    expect(buildState(planet(), r, 'crystal', 0, true, 5)).toBe('full');
    expect(buildState(planet(), r, 'crystal', 0, false)).toBe('ready');
    expect(buildState(planet(), r, 'terraformer', 0, false, 1)).toBe(
      'noEnergy',
    );
    expect(buildState(planet(), r, 'terraformer', 0, false, 0)).toBe('ready');
    expect(buildState(busy, r, 'terraformer', 0, false, 1)).toBe('queueBusy');
  });
  it('of research', () => {
    const rq = {
      research: {},
      rq: { key: 'energy', lvl: 1, start: 0, end: 1, cost: [0, 0, 0] as const },
    };
    expect(researchState(planet(), rq, 'energy', 0)).toBe('running');
    expect(researchState(planet(), rq, 'laser', 1)).toBe('missing');
    expect(researchState(planet(), rq, 'laser', 0)).toBe('busy');
    expect(
      researchState(
        planet({
          bq: { key: 'lab', lvl: 2, start: 0, end: 1, cost: [0, 0, 0] },
        }),
        r,
        'laser',
        0,
      ),
    ).toBe('labBusy');
    expect(
      researchState(
        planet({
          bq: { key: 'metal', lvl: 2, start: 0, end: 1, cost: [0, 0, 0] },
        }),
        r,
        'laser',
        0,
      ),
    ).toBe('ready');
  });
  it('of research without enough energy production (#49)', () => {
    const rq = {
      research: {},
      rq: { key: 'energy', lvl: 1, start: 0, end: 1, cost: [0, 0, 0] as const },
    };
    expect(researchState(planet(), r, 'graviton', 0, 1)).toBe('noEnergy');
    expect(researchState(planet(), r, 'graviton', 0, 0)).toBe('ready');
    expect(researchState(planet(), r, 'graviton', 1, 1)).toBe('missing');
    expect(researchState(planet(), rq, 'graviton', 0, 1)).toBe('busy');
    const upgrading = planet({
      bq: { key: 'lab', lvl: 2, start: 0, end: 1, cost: [0, 0, 0] },
    });
    expect(researchState(upgrading, r, 'graviton', 0, 1)).toBe('labBusy');
  });
});

describe('fleet form', () => {
  const p = planet({ res: { m: 9000, c: 8000, d: 100 } });
  const form = {
    ships: { sc: 2 },
    to: { g: 1, s: 1, p: 9 },
    mission: 'transport',
    pct: 10,
    cargo: { m: 1000, c: 0, d: 50 },
  };
  it('previews distance, time, fuel and cargo', () => {
    expect(
      fleetPreview(p, { research: {}, rq: null }, { ...form, ships: {} }, U),
    ).toBeNull();
    expect(fleetPreview(p, { research: {}, rq: null }, form, U)).toEqual({
      dist: 1020,
      ms: Math.round(((3500 * Math.sqrt(10200 / 5000) + 10) / 5) * 1000),
      fuel: 3,
      cap: 10000,
      load: 1050,
      fuelShort: false,
      overload: false,
    });
    const heavy = fleetPreview(
      p,
      { research: {}, rq: null },
      { ...form, cargo: { m: 10000, c: 0, d: 98 } },
      U,
    )!;
    expect(heavy.fuelShort).toBe(true);
    expect(heavy.overload).toBe(true);
    const exact = fleetPreview(
      p,
      { research: {}, rq: null },
      { ...form, cargo: { m: 9903, c: 0, d: 97 } },
      U,
    )!;
    expect(exact.fuelShort).toBe(false);
    expect(exact.overload).toBe(false);
  });
  it('fills the holds with metal, then crystal, then deuterium without the fuel', () => {
    expect(cargoMax(p, form)).toEqual({ m: 9000, c: 1000, d: 0 });
    expect(
      cargoMax(planet({ res: { m: 100, c: 200, d: 1000 } }), form),
    ).toEqual({ m: 100, c: 200, d: 997 });
    expect(cargoMax(planet({ res: { m: 1.9, c: 0, d: 1 } }), form)).toEqual({
      m: 1,
      c: 0,
      d: 0,
    });
    expect(cargoMax(p, { ...form, ships: {} })).toEqual({ m: 0, c: 0, d: 0 });
  });
});

describe('galaxy navigation', () => {
  it('stops at the galaxies and wraps the systems', () => {
    expect(galaxyStep(1, 5, 'g-', U)).toEqual({ gal: 1, sys: 5 });
    expect(galaxyStep(1, 5, 'g+', U)).toEqual({ gal: 2, sys: 5 });
    expect(galaxyStep(2, 5, 'g+', U)).toEqual({ gal: 2, sys: 5 });
    expect(galaxyStep(1, 1, 's-', U)).toEqual({ gal: 1, sys: 50 });
    expect(galaxyStep(1, 50, 's+', U)).toEqual({ gal: 1, sys: 1 });
    expect(galaxyStep(1, 7, 's+', U)).toEqual({ gal: 1, sys: 8 });
    expect(galaxyStep(1, 7, '??', U)).toEqual({ gal: 1, sys: 7 });
  });
});

describe('reports and settings', () => {
  const reps = [
    { id: '1', time: 5, type: 'info', title: 'a' },
    { id: '2', time: 9, type: 'info', title: 'b' },
  ] as Report[];
  it('count unread reports and sort the newest first', () => {
    expect(unread(reps, 5)).toBe(1);
    expect(unread(reps, 0)).toBe(2);
    expect(newestFirst(reps).map((r) => r.id)).toEqual(['2', '1']);
    expect(reps[0]!.id).toBe('1');
  });
  it('read the admin form', () => {
    expect(
      settingsFrom(['speed', 'galaxies'], (k) => (k === 'speed' ? '7' : '2')),
    ).toEqual({ speed: '7', galaxies: '2' });
  });
});
