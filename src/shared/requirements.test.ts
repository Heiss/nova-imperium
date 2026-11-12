import { describe, expect, it } from 'vitest';
import { planet, U } from '../test/fixtures.ts';
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
const places = (here: Planet, r: ResearchState): Places => ({
  here,
  research: r,
  cfg: U,
});

describe('unmet requirements', () => {
  it('are empty when everything is met', () => {
    const h = home({ b: { yard: 2, robot: 2 } });
    expect(unmetRequirements(UNIT.sc!.req, places(h, R({ comb: 2 })))).toEqual(
      [],
    );
    expect(unmetRequirements(undefined, places(h, R()))).toEqual([]);
  });

  it('list direct and indirect ones, flat, direct first', () => {
    const h = home();
    const list = unmetRequirements(UNIT.sc!.req, places(h, R()));
    expect(list).toEqual([
      {
        kind: 'b',
        key: 'yard',
        name: 'Orbitale Schiffsschmiede',
        level: 2,
        have: 0,
      },
      {
        kind: 'r',
        key: 'comb',
        name: 'Promethium-Brennkammer',
        level: 2,
        have: 0,
      },
      {
        kind: 'b',
        key: 'robot',
        name: 'Servitorenschmiede',
        level: 2,
        have: 0,
        via: 'Orbitale Schiffsschmiede',
      },
      {
        kind: 'b',
        key: 'lab',
        name: 'Scholarium',
        level: 1,
        have: 0,
        via: 'Promethium-Brennkammer',
      },
      {
        kind: 'r',
        key: 'energy',
        name: 'Machina-Energetik',
        level: 1,
        have: 0,
        via: 'Promethium-Brennkammer',
      },
    ]);
  });

  it('show the current level', () => {
    const h = home({ b: { yard: 1, robot: 2 } });
    const [yard] = unmetRequirements(UNIT.sc!.req, places(h, R({ comb: 2 })));
    expect(yard).toMatchObject({ key: 'yard', level: 2, have: 1 });
  });

  it('do not look behind a requirement that is met', () => {
    const h = home({ b: { lab: 0 } });
    const list = unmetRequirements(RES.laser!.req, places(h, R({ energy: 2 })));
    expect(list.map((n) => n.key)).toEqual(['lab']);
  });

  it('keep the highest level once and drop „via“ when also direct', () => {
    const h = home();
    const list = unmetRequirements(RES.hyper!.req, places(h, R()));
    const keys = list.map((n) => `${n.kind}:${n.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.find((n) => n.key === 'lab')).toMatchObject({ level: 7 });
    expect(list.find((n) => n.key === 'lab')?.via).toBeUndefined();
    expect(list.find((n) => n.key === 'energy')).toMatchObject({ level: 5 });
    expect(list.find((n) => n.key === 'energy')?.via).toBeUndefined();
  });

  it('keep the first „via“ of an indirect requirement', () => {
    const h = home();
    const list = unmetRequirements(UNIT.hf!.req, places(h, R()));
    expect(list.find((n) => n.key === 'lab')).toMatchObject({
      level: 2,
      via: 'Adamant-Panzerung',
    });
  });

  it('put the buildings of research on the shown planet (#49)', () => {
    // Research starts on any own planet with a lab, so a colony builds its own.
    const c = colony({ b: { robot: 2 } });
    const list = unmetRequirements(UNIT.sc!.req, places(c, R()));
    expect(list.map((n) => n.key)).toEqual(['yard', 'comb', 'lab', 'energy']);
  });

  it('check research buildings against the lab of the shown planet (#49)', () => {
    const withLab = unmetRequirements(
      UNIT.sc!.req,
      places(colony({ b: { lab: 1 } }), R()),
    );
    expect(withLab.map((n) => n.key)).not.toContain('lab');
    const withoutLab = unmetRequirements(
      RES.spy!.req,
      places(colony({ b: { lab: 2 } }), R()),
    );
    expect(withoutLab).toEqual([
      {
        kind: 'b',
        key: 'lab',
        name: 'Scholarium',
        level: 3,
        have: 2,
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

const busyQueue = {
  key: 'spy',
  lvl: 1,
  start: 0,
  end: 9,
  cost: [0, 0, 0],
};

describe('need state', () => {
  const need = (key: string, kind: 'b' | 'r') => ({
    kind,
    key,
    name: (kind === 'b' ? BUILD : RES)[key]!.n,
    level: 3,
    have: 0,
  });

  it('is ready when the next level is allowed and affordable', () => {
    const h = home({ res: { m: 1000, c: 1000, d: 1000 } });
    const s = needState(need('robot', 'b'), places(h, R()));
    expect(s).toEqual({ ready: true, cost: [400, 120, 200] });
  });

  it('names the missing requirements of the next level', () => {
    const h = home({ res: { m: 1e6, c: 1e6, d: 1e6 } });
    expect(needState(need('yard', 'b'), places(h, R()))).toMatchObject({
      ready: false,
      reason: 'braucht Servitorenschmiede (Stufe 2)',
    });
  });

  it('names the missing resources', () => {
    const h = home({ res: { m: 1000, c: 100, d: 10 } });
    expect(needState(need('robot', 'b'), places(h, R()))).toMatchObject({
      ready: false,
      reason: 'zu wenig Psikristall, Promethium',
    });
    const poor = home({ res: { m: 0, c: 1000, d: 1000 } });
    expect(needState(need('robot', 'b'), places(poor, R()))).toMatchObject({
      reason: 'zu wenig Adamant',
    });
  });

  it('costs the next level, not the required one', () => {
    const h = home({ b: { robot: 1 }, res: { m: 1e6, c: 1e6, d: 1e6 } });
    const s = needState({ ...need('robot', 'b'), have: 1 }, places(h, R()));
    expect(s.cost).toEqual([800, 240, 400]);
  });

  it('builds and pays on the shown planet (#49)', () => {
    const poor = colony({ res: { m: 0, c: 0, d: 0 } });
    const rich = colony({ res: { m: 1000, c: 1000, d: 1000 } });
    expect(needState(need('robot', 'b'), places(poor, R())).ready).toBe(false);
    expect(needState(need('robot', 'b'), places(rich, R())).ready).toBe(true);
  });

  it('checks and pays research on the shown planet (#49)', () => {
    const noLab = colony({ res: { m: 1e6, c: 1e6, d: 1e6 } });
    expect(needState(need('energy', 'r'), places(noLab, R()))).toMatchObject({
      ready: false,
      reason: 'braucht Scholarium (Stufe 1)',
    });
    const poor = colony({ b: { lab: 1 }, res: { m: 0, c: 0, d: 0 } });
    expect(needState(need('energy', 'r'), places(poor, R())).ready).toBe(false);
    const rich = colony({ b: { lab: 1 }, res: { m: 1e6, c: 1e6, d: 1e6 } });
    expect(needState(need('energy', 'r'), places(rich, R())).ready).toBe(true);
  });

  it('names the missing energy of Gravitonforschung (#49)', () => {
    const graviton = { ...need('graviton', 'r'), have: 0 };
    const dark = colony({ b: { lab: 12 } });
    expect(needState(graviton, places(dark, R()))).toEqual({
      ready: false,
      reason: 'zu wenig Energie',
      cost: [0, 0, 0],
      energy: 300000,
    });
    // The requirements come first.
    const small = colony({ b: { lab: 5, solar: 59 } });
    expect(needState(graviton, places(small, R())).reason).toBe(
      'braucht Scholarium (Stufe 12)',
    );
    const sunny = colony({ b: { lab: 12, solar: 59 } });
    expect(needState(graviton, places(sunny, R()))).toEqual({
      ready: true,
      cost: [0, 0, 0],
      energy: 300000,
    });
    expect(
      needState(graviton, places(sunny, R({}, busyQueue as never))),
    ).toMatchObject({ ready: true, busy: 'Es wird bereits geforscht' });
    const both = colony({ b: { lab: 12 }, res: { m: 0, c: 0, d: 0 } });
    expect(
      needState(
        { ...need('graviton', 'r'), have: 1 },
        places({ ...both, b: { lab: 12, solar: 59 } }, R()),
      ).reason,
    ).toBe('zu wenig Energie');
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
    expect(needState(need('robot', 'b'), places(building, R()))).toMatchObject({
      ready: true,
      busy: 'Bauschleife belegt',
    });
    const yard = home({
      res: rich,
      b: { robot: 2 },
      sq: [{ key: 'lf', n: 1, unit: 1 }],
    });
    expect(needState(need('yard', 'b'), places(yard, R())).busy).toBe(
      'Schiffsschmiede arbeitet gerade',
    );
    const lab = home({ res: rich });
    expect(
      needState(
        need('lab', 'b'),
        places(lab, R({}, { ...q, key: 'energy' } as never)),
      ).busy,
    ).toBe('Das Scholarium forscht gerade');
    const labHome = home({ res: rich, b: { lab: 1 } });
    expect(
      needState(
        need('energy', 'r'),
        places(labHome, R({}, { ...q, key: 'spy' } as never)),
      ).busy,
    ).toBe('Es wird bereits geforscht');
    const upgrading = home({
      res: rich,
      b: { lab: 1 },
      bq: { ...q, key: 'lab' },
    });
    expect(needState(need('energy', 'r'), places(upgrading, R())).busy).toBe(
      'Scholarium wird ausgebaut',
    );
    expect(
      needState(need('energy', 'r'), places(labHome, R())).busy,
    ).toBeUndefined();
  });
});
