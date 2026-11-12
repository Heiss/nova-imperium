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
    expect(C.RES).toEqual(O.RES);
    expect(C.SHIPS).toEqual({
      ...O.SHIPS,
      colony: C.SHIPS.colony,
      sat: C.SHIPS.sat,
    });
    expect(C.DEF).toEqual(O.DEF);
    expect(C.UNIT).toEqual({
      ...O.UNIT,
      colony: C.SHIPS.colony,
      sat: C.SHIPS.sat,
    });
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
    expect(C.isShip('rl')).toBe(false);
    expect(C.isShip('toString')).toBe(false);
    expect(C.isDefense('rl')).toBe(true);
    expect(C.isDefense('lf')).toBe(false);
    expect(C.PRODUCERS).toEqual(['metal', 'crystal', 'deut', 'solar', 'sat']);
  });
});
