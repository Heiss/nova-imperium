import { describe, expect, it } from 'vitest';
import { planet } from '../test/fixtures.ts';
import { BUILD, RES, UNIT } from './catalog.ts';
import { needState, unmetRequirements, type Places } from './requirements.ts';
import type { Planet, ResearchState } from './types.ts';

const home = (over: Partial<Planet> = {}): Planet =>
  planet({ id: 'home', ...over });
const colony = (over: Partial<Planet> = {}): Planet =>
  planet({ id: 'col', ...over });
const R = (
  research: ResearchState['research'] = {},
  rq = null,
): ResearchState => ({
  research,
  rq,
});
const places = (here: Planet, h: Planet, r: ResearchState): Places => ({
  here,
  home: h,
  research: r,
});

describe('unmet requirements', () => {
  it('are empty when everything is met', () => {
    const h = home({ b: { yard: 2, robot: 2 } });
    expect(
      unmetRequirements(UNIT.sc!.req, 'here', places(h, h, R({ comb: 2 }))),
    ).toEqual([]);
    expect(unmetRequirements(undefined, 'here', places(h, h, R()))).toEqual([]);
  });

  it('list direct and indirect ones, flat, direct first', () => {
    const h = home();
    const list = unmetRequirements(UNIT.sc!.req, 'here', places(h, h, R()));
    expect(list).toEqual([
      {
        kind: 'b',
        key: 'yard',
        name: 'Raumschiffwerft',
        level: 2,
        have: 0,
        planet: 'home',
      },
      {
        kind: 'r',
        key: 'comb',
        name: 'Verbrennungstriebwerk',
        level: 2,
        have: 0,
        planet: 'home',
      },
      {
        kind: 'b',
        key: 'robot',
        name: 'Roboterfabrik',
        level: 2,
        have: 0,
        planet: 'home',
        via: 'Raumschiffwerft',
      },
      {
        kind: 'b',
        key: 'lab',
        name: 'Forschungslabor',
        level: 1,
        have: 0,
        planet: 'home',
        via: 'Verbrennungstriebwerk',
      },
      {
        kind: 'r',
        key: 'energy',
        name: 'Energietechnik',
        level: 1,
        have: 0,
        planet: 'home',
        via: 'Verbrennungstriebwerk',
      },
    ]);
  });

  it('show the current level', () => {
    const h = home({ b: { yard: 1, robot: 2 } });
    const [yard] = unmetRequirements(
      UNIT.sc!.req,
      'here',
      places(h, h, R({ comb: 2 })),
    );
    expect(yard).toMatchObject({ key: 'yard', level: 2, have: 1 });
  });

  it('do not look behind a requirement that is met', () => {
    const h = home({ b: { lab: 0 } });
    const list = unmetRequirements(
      RES.laser!.req,
      'home',
      places(h, h, R({ energy: 2 })),
    );
    expect(list.map((n) => n.key)).toEqual(['lab']);
  });

  it('keep the highest level once and drop „via“ when also direct', () => {
    const h = home();
    const list = unmetRequirements(RES.hyper!.req, 'home', places(h, h, R()));
    const keys = list.map((n) => `${n.kind}:${n.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.find((n) => n.key === 'lab')).toMatchObject({ level: 7 });
    expect(list.find((n) => n.key === 'lab')?.via).toBeUndefined();
    expect(list.find((n) => n.key === 'energy')).toMatchObject({ level: 5 });
    expect(list.find((n) => n.key === 'energy')?.via).toBeUndefined();
  });

  it('keep the first „via“ of an indirect requirement', () => {
    const h = home();
    const list = unmetRequirements(UNIT.hf!.req, 'here', places(h, h, R()));
    expect(list.find((n) => n.key === 'lab')).toMatchObject({
      level: 2,
      via: 'Raumschiffpanzerung',
    });
  });

  it('put the buildings of research on the home planet when on a colony', () => {
    const c = colony({ b: { robot: 2 } });
    const h = home({ b: { robot: 0 } });
    const list = unmetRequirements(UNIT.sc!.req, 'here', places(c, h, R()));
    expect(list.map((n) => `${n.key}@${n.planet}`)).toEqual([
      'yard@col',
      'comb@home',
      'lab@home',
      'energy@home',
    ]);
  });

  it('check research buildings against the home planet', () => {
    const c = colony();
    const h = home({ b: { lab: 1 } });
    const list = unmetRequirements(UNIT.sc!.req, 'here', places(c, h, R()));
    expect(list.map((n) => n.key)).not.toContain('lab');
  });

  it('start research items on the home planet', () => {
    const c = colony({ b: { lab: 5 } });
    const h = home();
    const list = unmetRequirements(RES.spy!.req, 'home', places(c, h, R()));
    expect(list).toEqual([
      {
        kind: 'b',
        key: 'lab',
        name: 'Forschungslabor',
        level: 3,
        have: 0,
        planet: 'home',
      },
    ]);
  });
});

describe('the catalog', () => {
  it('has no circular requirements', () => {
    const all = { ...BUILD, ...RES, ...UNIT };
    const kindOf = (
      k: string,
    ): Record<string, { req?: { b?: object; r?: object } }> =>
      k in RES ? RES : BUILD;
    const visit = (key: string, path: string[]): void => {
      expect(path, `${path.join(' → ')} → ${key}`).not.toContain(key);
      const req = kindOf(key)[key]?.req ?? all[key]?.req;
      for (const k of [
        ...Object.keys(req?.b ?? {}),
        ...Object.keys(req?.r ?? {}),
      ])
        visit(k, [...path, key]);
    };
    for (const k of Object.keys(all)) visit(k, []);
  });
});

describe('need state', () => {
  const need = (key: string, kind: 'b' | 'r', planetId = 'home') => ({
    kind,
    key,
    name: (kind === 'b' ? BUILD : RES)[key]!.n,
    level: 3,
    have: 0,
    planet: planetId,
  });

  it('is ready when the next level is allowed and affordable', () => {
    const h = home({ res: { m: 1000, c: 1000, d: 1000 } });
    const s = needState(need('robot', 'b'), places(h, h, R()));
    expect(s).toEqual({ ready: true, cost: [400, 120, 200] });
  });

  it('names the missing requirements of the next level', () => {
    const h = home({ res: { m: 1e6, c: 1e6, d: 1e6 } });
    expect(needState(need('yard', 'b'), places(h, h, R()))).toMatchObject({
      ready: false,
      reason: 'braucht Roboterfabrik (Stufe 2)',
    });
  });

  it('names the missing resources', () => {
    const h = home({ res: { m: 1000, c: 100, d: 10 } });
    expect(needState(need('robot', 'b'), places(h, h, R()))).toMatchObject({
      ready: false,
      reason: 'zu wenig Kristall, Deuterium',
    });
    const poor = home({ res: { m: 0, c: 1000, d: 1000 } });
    expect(
      needState(need('robot', 'b'), places(poor, poor, R())),
    ).toMatchObject({
      reason: 'zu wenig Metall',
    });
  });

  it('costs the next level, not the required one', () => {
    const h = home({ b: { robot: 1 }, res: { m: 1e6, c: 1e6, d: 1e6 } });
    const s = needState({ ...need('robot', 'b'), have: 1 }, places(h, h, R()));
    expect(s.cost).toEqual([800, 240, 400]);
  });

  it('uses the planet of the requirement for buildings', () => {
    const c = colony({ res: { m: 0, c: 0, d: 0 } });
    const h = home({ res: { m: 1000, c: 1000, d: 1000 } });
    expect(needState(need('robot', 'b', 'home'), places(c, h, R())).ready).toBe(
      true,
    );
    expect(needState(need('robot', 'b', 'col'), places(c, h, R())).ready).toBe(
      false,
    );
  });

  it('pays research on the home planet (D4)', () => {
    const c = colony({ res: { m: 1e6, c: 1e6, d: 1e6 } });
    const h = home({ b: { lab: 1 }, res: { m: 0, c: 0, d: 0 } });
    expect(needState(need('energy', 'r'), places(c, h, R())).ready).toBe(false);
    const rich = home({ b: { lab: 1 }, res: { m: 1e6, c: 1e6, d: 1e6 } });
    expect(needState(need('energy', 'r'), places(c, rich, R())).ready).toBe(
      true,
    );
  });

  it('stays ready but busy while a queue is used', () => {
    const rich = { m: 1e6, c: 1e6, d: 1e6 };
    const q = {
      key: 'metal',
      lvl: 1,
      start: 0,
      end: 9,
      cost: [0, 0, 0] as [number, number, number],
    };
    const building = home({ res: rich, bq: q });
    expect(
      needState(need('robot', 'b'), places(building, building, R())),
    ).toMatchObject({
      ready: true,
      busy: 'Bauschleife belegt',
    });
    const yard = home({
      res: rich,
      b: { robot: 2 },
      sq: [{ key: 'lf', n: 1, unit: 1 }],
    });
    expect(needState(need('yard', 'b'), places(yard, yard, R())).busy).toBe(
      'Werft arbeitet gerade',
    );
    const lab = home({ res: rich });
    expect(
      needState(
        need('lab', 'b'),
        places(lab, lab, R({}, { ...q, key: 'energy' } as never)),
      ).busy,
    ).toBe('Das Labor forscht gerade');
    const labHome = home({ res: rich, b: { lab: 1 } });
    expect(
      needState(
        need('energy', 'r'),
        places(labHome, labHome, R({}, { ...q, key: 'spy' } as never)),
      ).busy,
    ).toBe('Es wird bereits geforscht');
    const upgrading = home({
      res: rich,
      b: { lab: 1 },
      bq: { ...q, key: 'lab' },
    });
    expect(
      needState(need('energy', 'r'), places(upgrading, upgrading, R())).busy,
    ).toBe('Labor wird ausgebaut');
    expect(
      needState(need('energy', 'r'), places(labHome, labHome, R())).busy,
    ).toBeUndefined();
  });
});
