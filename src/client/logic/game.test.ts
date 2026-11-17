import { describe, expect, it } from 'vitest';
import { planet, U } from '../../test/fixtures.ts';
import { dt } from './format.ts';
import {
  buildState,
  cargoMax,
  arrivalLine,
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
    // A fleet that holds is due at the end of its holding time (#55).
    expect(fleetEnd({ ...f('1', 'out', 5, 90), state: 'hold', hold: 7 })).toBe(
      12,
    );
    expect(
      sortFleets([
        f('1', 'out', 30),
        f('2', 'back', 1, 20),
        f('3', 'out', 10),
      ]).map((x) => x.id),
    ).toEqual(['3', '2', '1']);
    const list = [f('1', 'out', 30), f('2', 'out', 10)];
    sortFleets(list);
    expect(list.map((x) => x.id)).toEqual(['1', '2']);
  });
});

describe('button states', () => {
  const r = { research: {}, rq: null };
  const rich = { m: 1e9, c: 1e9, d: 1e9 };
  const poor = { m: 0, c: 0, d: 0 };
  const upgrade = (key: string) =>
    ({ key, lvl: 1, start: 0, end: 9, cost: [0, 0, 0] }) as const;
  const researching = {
    research: {},
    rq: { key: 'energy', lvl: 1, start: 0, end: 1, cost: [0, 0, 0] as const },
  };
  it('of buildings', () => {
    const busy = planet({ res: rich, bq: upgrade('metal') });
    expect(buildState(busy, r, 'metal', U)).toBe('running');
    expect(buildState(busy, r, 'yard', U)).toBe('locked');
    expect(buildState(busy, r, 'crystal', U)).toBe('busy');
    const orders = { res: rich, sq: [{ key: 'lf', n: 1, unit: 1 }] };
    const robots = planet({ ...orders, b: { robot: 2 } });
    expect(buildState(robots, r, 'yard', U)).toBe('yardBusy');
    const computer = { research: { computer: 10 }, rq: null };
    const factory = planet({ ...orders, b: { robot: 10 } });
    expect(buildState(factory, computer, 'nanite', U)).toBe('yardBusy');
    const home = planet({ res: rich });
    expect(buildState(home, researching, 'lab', U)).toBe('labBusy');
    expect(buildState(home, r, 'lab', U)).toBe('ready');
    const yard = planet({ res: rich, b: { robot: 2 } });
    expect(buildState(yard, r, 'yard', U)).toBe('ready');
    expect(buildState(planet({ res: poor }), r, 'lab', U)).toBe('cost');
  });
  it('of buildings on a full planet or without energy (#51)', () => {
    // 10,000 km: 100 fields, all taken.
    const full = { res: rich, diameter: 10000, b: { metal: 100 } };
    const busy = planet({ ...full, bq: upgrade('metal') });
    expect(buildState(busy, r, 'metal', U)).toBe('running');
    expect(buildState(busy, r, 'yard', U)).toBe('locked');
    expect(buildState(busy, r, 'crystal', U)).toBe('full');
    expect(buildState(planet(full), r, 'crystal', U)).toBe('full');
    expect(buildState(planet({ res: rich }), r, 'crystal', U)).toBe('ready');
    const forge = { research: { energy: 12 }, rq: null };
    const dark = { res: rich, b: { nanite: 1 } };
    expect(buildState(planet(dark), forge, 'terraformer', U)).toBe('noEnergy');
    const sunny = planet({ res: rich, b: { nanite: 1, solar: 14 } });
    expect(buildState(sunny, forge, 'terraformer', U)).toBe('ready');
    const building = planet({ ...dark, bq: upgrade('metal') });
    expect(buildState(building, forge, 'terraformer', U)).toBe('busy');
  });
  it('of research', () => {
    const lab = { res: rich, b: { lab: 1 } };
    const home = planet(lab);
    expect(researchState(home, researching, 'energy', U)).toBe('running');
    expect(researchState(home, researching, 'laser', U)).toBe('locked');
    expect(researchState(home, researching, 'computer', U)).toBe('busy');
    const upgrading = planet({ ...lab, bq: upgrade('lab') });
    expect(researchState(upgrading, r, 'computer', U)).toBe('labUpgrading');
    const building = planet({ ...lab, bq: upgrade('metal') });
    expect(researchState(building, r, 'computer', U)).toBe('ready');
    const none = planet({ res: rich });
    expect(researchState(none, r, 'computer', U)).toBe('noLab');
    const empty = planet({ b: { lab: 1 }, res: poor });
    expect(researchState(empty, r, 'computer', U)).toBe('cost');
  });
  it('of research without enough energy production (#49)', () => {
    const dark = { res: rich, b: { lab: 12 } };
    expect(researchState(planet(dark), r, 'graviton', U)).toBe('noEnergy');
    const sunny = planet({ res: rich, b: { lab: 12, solar: 59 } });
    expect(researchState(sunny, r, 'graviton', U)).toBe('ready');
    const small = planet({ res: rich, b: { lab: 11 } });
    expect(researchState(small, r, 'graviton', U)).toBe('locked');
    const busy = planet(dark);
    expect(researchState(busy, researching, 'graviton', U)).toBe('busy');
    const upgrading = planet({ ...dark, bq: upgrade('lab') });
    expect(researchState(upgrading, r, 'graviton', U)).toBe('labUpgrading');
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
      hold: 0,
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
  it('adds the fuel and the time of holding to a Halten only (#55)', () => {
    const r = { research: {}, rq: null };
    const flight = fleetPreview(p, r, form, U)!;
    const holding = { ...form, mission: 'hold', hold: 4 };
    // Kleiner Transporter: 2 × 10 × 4 / 10 = 8 Promethium for 4 hours.
    expect(fleetPreview(p, r, holding, U)).toEqual({
      ...flight,
      hold: 4 * 3_600_000,
      fuel: flight.fuel + 8,
    });
    expect(fleetPreview(p, r, { ...form, hold: 4 }, U)).toEqual(flight);
    // Without a choice it holds for no time and pays the least, 1.
    expect(fleetPreview(p, r, { ...form, mission: 'hold' }, U)!.fuel).toBe(
      flight.fuel + 1,
    );
    expect(cargoMax(planet({ res: { m: 0, c: 0, d: 1000 } }), holding)).toEqual(
      { m: 0, c: 0, d: 1000 - flight.fuel - 8 },
    );
  });
  it('shows the arrival and the return, after the holding time, or none for a Verlegung', () => {
    const pv = { ms: 60_000, hold: 3_600_000 };
    expect(arrivalLine('hold', 1000, pv)).toBe(
      `${dt(61_000)} / ${dt(1000 + 120_000 + 3_600_000)}`,
    );
    expect(arrivalLine('transport', 1000, { ms: 60_000, hold: 0 })).toBe(
      `${dt(61_000)} / ${dt(121_000)}`,
    );
    expect(arrivalLine('deploy', 1000, pv)).toBe(`${dt(61_000)} / –`);
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
    expect(galaxyStep(1, 2, 's-', U)).toEqual({ gal: 1, sys: 1 });
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
