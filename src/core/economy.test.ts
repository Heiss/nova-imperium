import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { BUILD, DEF, RES, SHIPS } from './catalog.ts';
import {
  accrue,
  afford,
  buildTime,
  capOf,
  caps,
  lvlCost,
  maxAfford,
  pay,
  prod,
  refund,
  reqMissing,
  researchTime,
  satEnergy,
  satPower,
  sumLevels,
  unitTime,
} from './economy.ts';

describe('costs', () => {
  it('grow with the factor of the building, rounded down', () => {
    expect(lvlCost(BUILD.metal!, 1)).toEqual([60, 15, 0]);
    expect(lvlCost(BUILD.metal!, 2)).toEqual([90, 22, 0]);
    expect(lvlCost(BUILD.crystal!, 3)).toEqual([122, 61, 0]);
  });
  it('double per level for research (no factor)', () => {
    expect(lvlCost(RES.energy!, 1)).toEqual([0, 800, 400]);
    expect(lvlCost(RES.energy!, 3)).toEqual([0, 3200, 1600]);
  });
  it('sum up over all levels', () => {
    expect(sumLevels(BUILD.metal!, 0)).toBe(0);
    expect(sumLevels(BUILD.metal!, 1)).toBe(75);
    expect(sumLevels(BUILD.metal!, 2)).toBe(75 + 112);
  });
});

describe('storage', () => {
  it('starts at the base value and grows with 1.6^level', () => {
    expect(capOf(0, U)).toBe(100000);
    expect(capOf(1, U)).toBe(150000);
    expect(capOf(3, U)).toBe(100000 + 50000 * 4);
    expect(capOf(0, { ...U, baseStore: 20000 })).toBe(20000);
  });
  it('is read per resource from the storage buildings', () => {
    expect(
      caps(planet({ b: { smetal: 1, scrystal: 2, sdeut: 3 } }), U),
    ).toEqual({
      m: 150000,
      c: 200000,
      d: 300000,
    });
  });
});

describe('times', () => {
  const p = planet({ b: { robot: 1, lab: 3, yard: 1 } });
  it('depend on cost, building level and speed', () => {
    expect(buildTime([5000, 5000, 0], p, U)).toBe(1440000);
    expect(buildTime([5000, 5000, 0], planet(), U)).toBe(2880000);
    expect(researchTime([1000, 1000, 0], p, U)).toBe(360000);
    expect(unitTime(SHIPS.lf!, p, U)).toBe(576000);
    expect(buildTime([5000, 5000, 0], p, { ...U, speed: 10 })).toBe(720000);
  });
  it('halve per level of the Nanitenfabrik, but not research (#48)', () => {
    const n = (nanite: number) =>
      planet({ b: { robot: 1, lab: 3, yard: 1, nanite } });
    expect(buildTime([5000, 5000, 0], n(1), U)).toBe(720000);
    expect(buildTime([5000, 5000, 0], n(3), U)).toBe(180000);
    expect(unitTime(SHIPS.lf!, n(1), U)).toBe(288000);
    expect(unitTime(SHIPS.lf!, n(2), U)).toBe(144000);
    expect(researchTime([1000, 1000, 0], n(5), U)).toBe(360000);
    expect(buildTime([1, 0, 0], n(10), U)).toBe(1000);
  });
  it('are at least one second', () => {
    expect(buildTime([1, 0, 0], p, U)).toBe(1000);
    expect(researchTime([1, 0, 0], p, U)).toBe(1000);
    expect(unitTime({ cost: [1, 0, 0] }, p, U)).toBe(1000);
  });
});

describe('paying', () => {
  it('checks every resource', () => {
    const p = planet({ res: { m: 100, c: 50, d: 10 } });
    expect(afford(p, [100, 50, 10])).toBe(true);
    expect(afford(p, [101, 50, 10])).toBe(false);
    expect(afford(p, [100, 51, 10])).toBe(false);
    expect(afford(p, [100, 50, 11])).toBe(false);
    expect(afford(p, [50, 25, 5], 2)).toBe(true);
    expect(afford(p, [50, 25, 5], 3)).toBe(false);
  });
  it('takes and gives back', () => {
    const p = planet({ res: { m: 100, c: 50, d: 10 } });
    pay(p, [10, 20, 5], 2);
    expect(p.res).toEqual({ m: 80, c: 10, d: 0 });
    refund(p, [10, 20, 5]);
    expect(p.res).toEqual({ m: 90, c: 30, d: 5 });
  });
  it('counts how many units can be paid', () => {
    const p = planet({ res: { m: 1000, c: 300, d: 0 } });
    expect(maxAfford(p, [100, 100, 0])).toBe(3);
    expect(maxAfford(p, [0, 0, 1])).toBe(0);
    expect(maxAfford(p, [300, 0, 0])).toBe(3);
  });
});

describe('requirements', () => {
  it('name the missing buildings and research with their level', () => {
    expect(
      reqMissing(SHIPS.cr!, planet({ b: { yard: 4 } }), {
        research: { impulse: 4 },
      }),
    ).toEqual([
      'Orbitale Schiffsschmiede (Stufe 5)',
      'Lichtlanzen-Lehre (Stufe 4)',
    ]);
    expect(
      reqMissing(SHIPS.cr!, planet({ b: { yard: 5 } }), {
        research: { impulse: 4, laser: 4 },
      }),
    ).toEqual([]);
    expect(reqMissing(BUILD.metal!, planet(), { research: {} })).toEqual([]);
  });
  it('name what the Schlachtkreuzer and the Zerstörer need (#58, #59)', () => {
    expect(
      reqMissing(SHIPS.bc!, planet({ b: { yard: 7 } }), {
        research: { laser: 11, hyper: 5, hdrive: 4 },
      }),
    ).toEqual([
      'Orbitale Schiffsschmiede (Stufe 8)',
      'Lichtlanzen-Lehre (Stufe 12)',
      'Warp-Antrieb (Stufe 5)',
    ]);
    expect(
      reqMissing(SHIPS.bc!, planet({ b: { yard: 8 } }), {
        research: { laser: 12, hyper: 5, hdrive: 5 },
      }),
    ).toEqual([]);
    expect(
      reqMissing(SHIPS.dr!, planet({ b: { yard: 8 } }), {
        research: { hyper: 4, hdrive: 6 },
      }),
    ).toEqual(['Orbitale Schiffsschmiede (Stufe 9)', 'Warp-Theorie (Stufe 5)']);
    expect(
      reqMissing(SHIPS.dr!, planet({ b: { yard: 9 } }), {
        research: { hyper: 5, hdrive: 6 },
      }),
    ).toEqual([]);
  });
  it('name what the new defense needs (#50)', () => {
    const cases: [string, number, string, number, string[]][] = [
      [
        'ionc',
        4,
        'ion',
        4,
        ['Orbitale Schiffsschmiede (Stufe 4)', 'Ionen-Lehre (Stufe 4)'],
      ],
      [
        'pt',
        8,
        'plasma',
        7,
        ['Orbitale Schiffsschmiede (Stufe 8)', 'Plasma-Lehre (Stufe 7)'],
      ],
      [
        'ssd',
        1,
        'shield',
        2,
        ['Orbitale Schiffsschmiede (Stufe 1)', 'Refraktionsfelder (Stufe 2)'],
      ],
      [
        'lsd',
        6,
        'shield',
        6,
        ['Orbitale Schiffsschmiede (Stufe 6)', 'Refraktionsfelder (Stufe 6)'],
      ],
    ];
    for (const [k, yard, tech, level, missing] of cases) {
      const d = DEF[k]!;
      const below = { research: { [tech]: level - 1 } };
      const enough = { research: { [tech]: level } };
      expect(reqMissing(d, planet({ b: { yard: yard - 1 } }), below)).toEqual(
        missing,
      );
      expect(reqMissing(d, planet({ b: { yard } }), enough)).toEqual([]);
    }
  });
});

describe('Bomber requirements', () => {
  it('name what the Bomber needs (#57)', () => {
    expect(
      reqMissing(SHIPS.bb!, planet({ b: { yard: 7 } }), {
        research: { impulse: 5, plasma: 4, hdrive: 8 },
      }),
    ).toEqual([
      'Orbitale Schiffsschmiede (Stufe 8)',
      'Plasma-Impulsantrieb (Stufe 6)',
      'Plasma-Lehre (Stufe 5)',
    ]);
    expect(
      reqMissing(SHIPS.bb!, planet({ b: { yard: 8 } }), {
        research: { impulse: 6, plasma: 5 },
      }),
    ).toEqual([]);
  });
});

describe('Todesstern', () => {
  it('names what the Todesstern needs (#60)', () => {
    expect(
      reqMissing(SHIPS.dstar!, planet({ b: { yard: 11 } }), {
        research: { hyper: 5, hdrive: 6 },
      }),
    ).toEqual([
      'Orbitale Schiffsschmiede (Stufe 12)',
      'Warp-Theorie (Stufe 6)',
      'Warp-Antrieb (Stufe 7)',
      'Gravitonen-Mysterium (Stufe 1)',
    ]);
    expect(
      reqMissing(SHIPS.dstar!, planet({ b: { yard: 12 } }), {
        research: { hyper: 6, hdrive: 7, graviton: 1 },
      }),
    ).toEqual([]);
  });
  it('takes 9,000,000 / (2,500 × 13) hours, halved per Nanitenfabrik level (#60)', () => {
    const at = (nanite: number) => planet({ b: { yard: 12, nanite } });
    // 276.9 hours at speed 1, about 55 h 23 min at ×5.
    expect(unitTime(SHIPS.dstar!, at(0), U)).toBe(199384616);
    expect(unitTime(SHIPS.dstar!, at(1), U)).toBe(99692308);
    expect(unitTime(SHIPS.dstar!, at(3), U)).toBe(24923077);
  });
});

describe('production', () => {
  it('has a base income without mines', () => {
    expect(prod(planet(), U)).toEqual({
      m: 100,
      c: 50,
      d: 0,
      eProd: 0,
      eUse: 0,
      f: 1,
    });
  });
  it('is limited by energy', () => {
    const p = planet({ b: { metal: 5, solar: 1 } });
    const pr = prod(p, U);
    expect(pr.eProd).toBeCloseTo(22, 10);
    expect(pr.eUse).toBeCloseTo(80.5255, 3);
    expect(pr.f).toBeCloseTo(22 / 80.5255, 4);
    expect(pr.m).toBeCloseTo((20 + 30 * 8.05255 * pr.f) * 5, 3);
  });
  it('follows the production share and the temperature', () => {
    const p = planet({
      b: { deut: 2, solar: 10 },
      temp: 100,
      pct: { deut: 50 },
    });
    const pr = prod(p, U);
    expect(pr.f).toBe(1);
    expect(pr.d).toBeCloseTo(10 * 2 * 1.21 * (1.28 - 0.2) * 0.5 * 5, 6);
    expect(pr.eUse).toBeCloseTo(20 * 2 * 1.21 * 0.5, 6);
    // A temperature of 0 counts as 20, like in the original.
    expect(prod({ ...p, temp: 0 }, U).d).toBe(prod({ ...p, temp: 20 }, U).d);
    expect(prod({ ...p, pct: { solar: 0 } }, U).f).toBe(0);
  });
  it('gives every Solarsatellit ⌊temp / 4 + 20⌋ energy (#46)', () => {
    expect(satEnergy(8)).toBe(22);
    expect(satEnergy(120)).toBe(50);
    expect(satEnergy(130)).toBe(52);
    expect(satEnergy(-10)).toBe(17);
    expect(satEnergy(-11)).toBe(17);
    expect(satEnergy(-12)).toBe(17);
    expect(satEnergy(-13)).toBe(16);
    expect(satEnergy(-80)).toBe(0);
    expect(satEnergy(-200)).toBe(0);
  });
  it('adds the satellites at their share to the energy', () => {
    const p = planet({ b: { metal: 5, solar: 1 }, temp: 8 });
    const base = prod(p, U);
    const withSats = prod({ ...p, ships: { sat: 3 } }, U);
    expect(withSats.eProd).toBeCloseTo(base.eProd + 66, 10);
    expect(withSats.eUse).toBe(base.eUse);
    expect(withSats.f).toBeCloseTo(Math.min(1, (22 + 66) / base.eUse), 10);
    const half = prod({ ...p, ships: { sat: 3 }, pct: { sat: 50 } }, U);
    expect(half.eProd).toBeCloseTo(base.eProd + 33, 10);
    const off = prod({ ...p, ships: { sat: 3 }, pct: { sat: 0 } }, U);
    expect(off.eProd).toBe(base.eProd);
    expect(satPower({ ...p, ships: { sat: 3 }, pct: {} })).toBe(66);
    expect(satPower({ ...p, ships: {}, pct: {} })).toBe(0);
    expect(satPower({ b: {}, pct: {}, temp: 8 })).toBe(0);
  });
  it('accrues up to the storage limit and never above', () => {
    const p = planet({ res: { m: 0, c: 99990, d: 200000 } });
    accrue(p, 3600000, U);
    expect(p.res).toEqual({ m: 100, c: 100000, d: 200000 });
    accrue(p, 0, U);
    accrue(p, -5, U);
    expect(p.res.m).toBe(100);
  });
});
