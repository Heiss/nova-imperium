import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
import { RES } from './catalog.ts';
import { fusionEnergy, fusionThrottle, prod, researchTime } from './economy.ts';
import {
  energyNeed,
  energyShort,
  type LabSite,
  labSite,
  networkLab,
} from './research.ts';

const site = (id: string, lab: number, upgrading = false): LabSite => ({
  id,
  lab,
  upgrading,
});

describe('lab site', () => {
  it('names the planet, its lab level and whether the lab is upgraded', () => {
    const q = { lvl: 7, start: 0, end: 9, cost: [0, 0, 0] as const };
    expect(labSite(planet({ id: 'a', b: { lab: 6 } }))).toEqual(site('a', 6));
    expect(
      labSite(planet({ id: 'b', b: { lab: 6 }, bq: { ...q, key: 'lab' } })),
    ).toEqual(site('b', 6, true));
    expect(
      labSite(planet({ id: 'c', b: {}, bq: { ...q, key: 'metal' } })),
    ).toEqual(site('c', 0));
  });
});

describe('research network (IFN)', () => {
  const home = site('home', 10);
  const colony = site('col', 6);

  it('adds the levels of linked labs: labs 10 and 6 research like lab 16', () => {
    expect(networkLab('shield', home, [home, colony], 1)).toBe(16);
    expect(networkLab('shield', colony, [home, colony], 1)).toBe(16);
  });

  it('leaves out labs below the lab requirement of the research', () => {
    // Hyperraumantrieb needs lab 7: the lab 6 does not join.
    expect(RES.hdrive!.req.b!.lab).toBe(7);
    expect(networkLab('hdrive', home, [home, colony], 1)).toBe(10);
    expect(networkLab('hdrive', home, [home, site('x', 7)], 1)).toBe(17);
  });

  it('uses only the own lab without IFN', () => {
    expect(networkLab('shield', home, [home, colony], 0)).toBe(10);
    expect(networkLab('shield', home, [], 3)).toBe(10);
  });

  it('links the IFN level many highest other labs', () => {
    const labs = [home, site('a', 3), site('b', 9), site('c', 5), site('d', 8)];
    expect(networkLab('energy', home, labs, 1)).toBe(19);
    expect(networkLab('energy', home, labs, 2)).toBe(27);
    expect(networkLab('energy', home, labs, 9)).toBe(35);
  });

  it('lets every lab join research without a lab requirement', () => {
    expect(networkLab('nope', home, [home, site('a', 1)], 1)).toBe(11);
  });

  it('never counts the starting lab twice', () => {
    expect(networkLab('energy', home, [home, home], 2)).toBe(10);
  });

  it('leaves out a lab that is being upgraded', () => {
    const busy = site('b', 9, true);
    expect(networkLab('energy', home, [home, busy, colony], 1)).toBe(16);
  });

  it('gives the research time of the summed level', () => {
    const c = RES.shield!.cost;
    const lab = networkLab('shield', home, [home, colony], 1);
    expect(researchTime(c, { b: { lab } }, U)).toBe(
      researchTime(c, { b: { lab: 16 } }, U),
    );
    expect(researchTime(c, { b: { lab } }, U)).toBeLessThan(
      researchTime(c, { b: { lab: 10 } }, U),
    );
  });
});

describe('energy of Gravitonforschung', () => {
  const graviton = RES.graviton!;
  // 20 · l · 1.1^l: Solarkraftwerk 58 gives about 291,900, 59 about 326,600.
  const solar = (l: number) => planet({ b: { solar: l } });

  it('needs 300,000 production at level 1 and three times more per level', () => {
    expect(energyNeed(graviton, 1)).toBe(300000);
    expect(energyNeed(graviton, 2)).toBe(900000);
    expect(energyNeed(graviton, 3)).toBe(2700000);
  });

  it('is not needed by research without an energy requirement', () => {
    expect(energyNeed(RES.energy!, 1)).toBe(0);
    expect(energyShort(RES.energy!, 5, planet(), U)).toBe(0);
  });

  it('names the missing production, rounded up', () => {
    const p = solar(58);
    const have = prod(p, U).eProd;
    expect(have).toBeLessThan(300000);
    expect(energyShort(graviton, 1, p, U)).toBe(Math.ceil(300000 - have));
    expect(energyShort(graviton, 1, solar(59), U)).toBe(0);
    expect(energyShort(graviton, 2, solar(59), U)).toBeGreaterThan(0);
  });

  it('counts the production, not what the mines use', () => {
    const p = planet({ b: { solar: 59, metal: 40, crystal: 40 } });
    expect(prod(p, U).eUse).toBeGreaterThan(0);
    expect(energyShort(graviton, 1, p, U)).toBe(0);
  });

  it('counts the Fusionskraftwerk with Energietechnik (#47)', () => {
    // Solarkraftwerk 58 alone lacks about 8,100; a reactor of level 12
    // gives 30 · 12 · 1.05^12 ≈ 646 without and about 2,064 with
    // Energietechnik 10, at 100 %.
    const p = planet({
      b: { solar: 58, fusion: 12 },
      res: { m: 0, c: 0, d: 1000 },
    });
    const lacking = 300000 - prod(solar(58), U).eProd;
    expect(energyShort(graviton, 1, p, U)).toBe(
      Math.ceil(lacking - fusionEnergy(12, 0)),
    );
    expect(energyShort(graviton, 1, p, U, { energy: 10 })).toBe(
      Math.ceil(lacking - fusionEnergy(12, 10)),
    );
    const big = planet({ b: { solar: 58, fusion: 20 }, res: p.res });
    expect(lacking).toBeLessThan(fusionEnergy(20, 10));
    expect(energyShort(graviton, 1, big, U, { energy: 10 })).toBe(0);
  });

  it('counts a reactor throttled at an empty stock at its throttled share (#47)', () => {
    const p = planet({
      b: { solar: 58, fusion: 20, deut: 10 },
      res: { m: 0, c: 0, d: 0 },
    });
    const r = { energy: 10 };
    const s = fusionThrottle(p, U, r)!;
    expect(s).toBeLessThan(100);
    expect(energyShort(graviton, 1, p, U, r)).toBe(
      Math.max(
        0,
        Math.ceil(300000 - prod({ ...p, pct: { fusion: s } }, U, r).eProd),
      ),
    );
    expect(energyShort(graviton, 1, p, U, r)).toBeGreaterThan(
      energyShort(graviton, 1, { ...p, res: { m: 0, c: 0, d: 1 } }, U, r),
    );
  });

  it('starts with the energy of Solarsatelliten alone and is refused one satellite below (#46)', () => {
    // No Solarkraftwerk, no Fusionskraftwerk: at 50 °C one satellite gives
    // ⌊50 / 4 + 20⌋ = 32, so 9,375 satellites give exactly 300,000.
    const sats = (n: number) =>
      planet({ temp: 50, b: { lab: 12 }, ships: { sat: n } });
    const enough = sats(9375);
    expect(enough.b).not.toHaveProperty('solar');
    expect(enough.b).not.toHaveProperty('fusion');
    expect(prod(enough, U).eProd).toBe(300000);
    expect(energyShort(graviton, 1, enough, U)).toBe(0);
    const below = sats(9374);
    expect(prod(below, U).eProd).toBe(299968);
    expect(prod(below, U).eProd).toBeLessThan(energyNeed(graviton, 1));
    expect(energyShort(graviton, 1, below, U)).toBe(32);
  });

  it('counts only the share of the Solarkraftwerk that runs', () => {
    const p = planet({ b: { solar: 59 }, pct: { solar: 50 } });
    expect(energyShort(graviton, 1, p, U)).toBeGreaterThan(0);
  });
});
