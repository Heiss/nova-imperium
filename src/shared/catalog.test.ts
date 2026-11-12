// Names, descriptions, costs and values of all units are those of version 1.
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import * as C from './catalog.ts';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const O: any = require('../test/legacy/game.cjs');

describe('catalog', () => {
  it('equals the catalog of version 1', () => {
    expect(C.BUILD).toEqual({ ...O.BUILD, nanite: C.BUILD.nanite });
    expect(C.RES).toEqual({
      ...O.RES,
      ion: C.RES.ion,
      plasma: C.RES.plasma,
      graviton: C.RES.graviton,
      ifn: C.RES.ifn,
    });
    const added = {
      colony: C.SHIPS.colony,
      bc: C.SHIPS.bc,
      dr: C.SHIPS.dr,
      sat: C.SHIPS.sat,
    };
    expect(C.SHIPS).toEqual({ ...O.SHIPS, ...added });
    expect(C.DEF).toEqual(O.DEF);
    expect(C.UNIT).toEqual({ ...O.UNIT, ...added });
    expect(C.DRIVE_BONUS).toEqual(O.DRIVE_BONUS);
    expect(C.MISSION).toEqual({ ...O.MISSION, colonize: 'Kolonisieren' });
  });
  it('has the Nanitenfabrik with the classic values (#48)', () => {
    expect(C.BUILD.nanite).toEqual({
      n: 'Nanitenfabrik',
      ab: 'Na',
      cost: [1000000, 500000, 100000],
      f: 2,
      ds: 'Halbiert die Bauzeit von Gebäuden, Schiffen und Verteidigung pro Stufe.',
      req: { b: { robot: 10 }, r: { computer: 10 } },
    });
  });
  it('has Ionen-, Plasmatechnik, Gravitonforschung and IFN with the classic values (#49)', () => {
    expect(C.RES.ion).toMatchObject({
      n: 'Ionentechnik',
      ab: 'Io',
      cost: [1000, 300, 100],
      req: { b: { lab: 4 }, r: { laser: 5, energy: 4 } },
    });
    expect(C.RES.plasma).toMatchObject({
      n: 'Plasmatechnik',
      ab: 'Pl',
      cost: [2000, 4000, 1000],
      req: { b: { lab: 4 }, r: { energy: 8, laser: 10, ion: 5 } },
    });
    expect(C.RES.graviton).toMatchObject({
      n: 'Gravitonforschung',
      ab: 'Gr',
      cost: [0, 0, 0],
      energy: { base: 300000, f: 3 },
      req: { b: { lab: 12 } },
    });
    expect(C.RES.ifn).toMatchObject({
      n: 'Intergalaktisches Forschungsnetzwerk',
      ab: 'IF',
      cost: [240000, 400000, 160000],
      req: { b: { lab: 10 }, r: { computer: 8, hyper: 8 } },
    });
    for (const k of ['ion', 'plasma', 'graviton', 'ifn']) {
      // Research has no own factor: every level doubles (lvlCost, f = 2).
      expect(C.RES[k]).not.toHaveProperty('f');
      expect(C.RES[k]!.ds).toMatch(/\S/);
      expect(C.RES[k]!.req.r ?? {}).not.toHaveProperty(k);
    }
    expect(Object.keys(C.RES).filter((k) => C.RES[k]!.energy)).toEqual([
      'graviton',
    ]);
  });
  it('gives the new research abbreviations no other entry uses (#49)', () => {
    const all = [C.BUILD, C.RES, C.UNIT].flatMap((d) =>
      Object.entries(d).map(([k, x]) => [k, x.ab] as const),
    );
    for (const k of ['ion', 'plasma', 'graviton', 'ifn']) {
      const ab = C.RES[k]!.ab;
      expect(all.filter(([, a]) => a === ab).map(([key]) => key)).toEqual([k]);
    }
  });
  it('has the Schlachtkreuzer with the classic values (#58)', () => {
    expect(C.SHIPS.bc).toEqual({
      n: 'Schlachtkreuzer',
      ab: 'SK',
      cost: [30000, 40000, 15000],
      atk: 700,
      sh: 400,
      cargo: 750,
      speed: 10000,
      fuel: 250,
      drive: 'hdrive',
      req: { b: { yard: 8 }, r: { laser: 12, hyper: 5, hdrive: 5 } },
      rf: { sc: 3, lc: 3, hf: 4, cr: 4, bs: 7 },
      ds: 'Schnell und stark gegen Transporter, Kreuzer und Schlachtschiffe.',
    });
  });
  it('has the Zerstörer with the classic values (#59)', () => {
    expect(C.SHIPS.dr).toEqual({
      n: 'Zerstörer',
      ab: 'ZE',
      cost: [60000, 50000, 15000],
      atk: 2000,
      sh: 500,
      cargo: 2000,
      speed: 5000,
      fuel: 1000,
      drive: 'hdrive',
      req: { b: { yard: 9 }, r: { hdrive: 6, hyper: 5 } },
      rf: { ll: 10, bc: 2 },
      ds: 'Schweres Kriegsschiff – stark gegen Lasergeschütze und Schlachtkreuzer.',
    });
  });
  it('gives the new ships abbreviations no other entry uses', () => {
    const all = [C.BUILD, C.RES, C.SHIPS, C.DEF].flatMap((defs) =>
      Object.values(defs).map((d) => d.ab),
    );
    for (const ab of [C.SHIPS.bc!.ab, C.SHIPS.dr!.ab])
      expect(all.filter((x) => x === ab)).toEqual([ab]);
  });
  it('has the Solarsatellit with the classic values (#46)', () => {
    expect(C.SHIPS.sat).toEqual({
      n: 'Solarsatellit',
      ab: 'SA',
      cost: [0, 2000, 500],
      atk: 1,
      sh: 1,
      cargo: 0,
      speed: 0,
      fuel: 0,
      drive: 'comb',
      req: { b: { yard: 1 } },
      ds: 'Liefert Energie, je wärmer der Planet, desto mehr. Kann nicht fliegen.',
    });
  });
  it('knows which ships can fly', () => {
    expect(C.canFly('lf')).toBe(true);
    expect(C.canFly('probe')).toBe(true);
    expect(C.canFly('sat')).toBe(false);
    expect(C.canFly('rl')).toBe(false);
    expect(C.canFly('toString')).toBe(false);
  });
  it('tells ships from defense', () => {
    expect(C.isShip('lf')).toBe(true);
    expect(C.isShip('bc')).toBe(true);
    expect(C.isShip('dr')).toBe(true);
    expect(C.isShip('rl')).toBe(false);
    expect(C.isShip('toString')).toBe(false);
    expect(C.isDefense('rl')).toBe(true);
    expect(C.isDefense('lf')).toBe(false);
    expect(C.PRODUCERS).toEqual(['metal', 'crystal', 'deut', 'solar', 'sat']);
  });
});
