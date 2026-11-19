// What a level brings (#187): the effects of the components of an entry,
// checked against the formulas of the core they come from.
import { describe, expect, it } from 'vitest';
import { BUILD, PRODUCTION, RES, STORAGE } from '../../core/catalog.ts';
import {
  buildTime,
  capOf,
  fusionUse,
  prod,
  researchTime,
  unitTime,
} from '../../core/economy.ts';
import { U } from '../../test/fixtures.ts';
import { levelView } from '../../test/level-view.ts';
import {
  ENERGY_NEED,
  fieldsEffect,
  producerEffect,
  storageEffect,
  timeEffects,
  useEffects,
} from './level-effects.ts';

const view = () => levelView({ temp: 30 }, { energy: 4 });

describe('what a producer makes', () => {
  it('is the rate of its component at full share, as prod() adds it', () => {
    const v = view();
    const rich = { b: { solar: 40 }, pct: {} };
    for (const [key, res] of [
      ['metal', 'm'],
      ['crystal', 'c'],
      ['deut', 'd'],
    ] as const)
      for (const level of [1, 5, 12]) {
        const here = { ...v.P, ...rich, b: { solar: 40, [key]: level } };
        const none = { ...v.P, ...rich };
        expect(
          producerEffect(v, key)!.at(level),
          `${key} ${level}`,
        ).toBeCloseTo(
          prod(here, U, v.R.research)[res] - prod(none, U, v.R.research)[res],
          6,
        );
      }
  });

  it('names what it makes, a mine with its energy', () => {
    const v = view();
    expect(producerEffect(v, 'metal')!.label).toBe(
      'Adamant/h bei voller Energie',
    );
    expect(producerEffect(v, 'crystal')!.label).toBe(
      'Psikristall/h bei voller Energie',
    );
    expect(producerEffect(v, 'deut')!.label).toBe(
      'Promethium/h bei voller Energie',
    );
    expect(producerEffect(v, 'solar')!.label).toBe('Energie');
    expect(producerEffect(v, 'fusion')!.label).toBe('Energie');
  });

  it('makes more with every level, and energy needs no share', () => {
    const v = view();
    for (const { key, kind } of PRODUCTION) {
      if (kind !== 'building') continue;
      const e = producerEffect(v, key)!;
      expect(e.at(0), key).toBeGreaterThanOrEqual(0);
      expect(e.at(6), key).toBeGreaterThan(e.at(1));
    }
  });

  it('is none for a ship that produces, a store and a building without a rate', () => {
    const v = view();
    expect(producerEffect(v, 'sat')).toBeUndefined();
    expect(producerEffect(v, 'lab')).toBeUndefined();
    expect(producerEffect(v, 'smetal')).toBeUndefined();
    expect(producerEffect(v, 'weapons')).toBeUndefined();
    expect(producerEffect(v, 'nothing')).toBeUndefined();
  });
});

describe('what a store holds', () => {
  it('is the capacity of the level, for each store', () => {
    const v = view();
    expect(STORAGE.length).toBeGreaterThan(0);
    for (const { key } of STORAGE)
      for (const level of [0, 1, 7])
        expect(storageEffect(v, key)!.at(level)).toBe(capOf(level, U));
    expect(storageEffect(v, 'metal')).toBeUndefined();
    expect(storageEffect(v, 'computer')).toBeUndefined();
  });
});

describe('the fields a building adds', () => {
  it('are its `fields` times the level, as maxFields() counts them', () => {
    const adding = Object.entries(BUILD).filter(([, d]) => d.fields);
    expect(adding.length).toBeGreaterThan(0);
    for (const [key, def] of adding)
      for (const level of [0, 1, 6])
        expect(fieldsEffect(key)!.at(level), `${key} ${level}`).toBe(
          def.fields! * level,
        );
    expect(fieldsEffect('terraformer')!.label).toBe('Zusätzliche Felder');
  });

  it('are none for an entry without `fields`', () => {
    for (const key of [
      'metal',
      'lab',
      'computer',
      'sat',
      'nothing',
      'toString',
    ])
      expect(fieldsEffect(key), key).toBeUndefined();
  });
});

describe('what a building uses', () => {
  it('is the energy a mine needs, as prod() counts it', () => {
    const v = view();
    for (const key of ['metal', 'crystal', 'deut'])
      for (const level of [1, 4, 9]) {
        const here = { ...v.P, b: { [key]: level }, pct: {} };
        const [need] = useEffects(v, key);
        expect(need!.label).toBe(ENERGY_NEED);
        expect(need!.cost, key).toBe(true);
        expect(need!.at(level), `${key} ${level}`).toBeCloseTo(
          prod(here, U, v.R.research).eUse,
          6,
        );
      }
  });

  it('is the Promethium the Fusionskraftwerk burns, a column of its own', () => {
    const v = view();
    const use = useEffects(v, 'fusion');
    expect(use.map((e) => e.label)).toEqual(['Promethiumverbrauch/h']);
    expect(use[0]!.at(5)).toBe(fusionUse(5, U));
    expect(use[0]!.cost).toBe(true);
  });

  it('is none for a building that uses nothing, a research and a ship', () => {
    const v = view();
    for (const key of ['solar', 'lab', 'robot', 'computer', 'sat', 'nothing'])
      expect(useEffects(v, key), key).toEqual([]);
  });
});

describe('the time factors', () => {
  /** The factor of one level, as the times of the core make it. */
  const factor = (
    key: string,
    level: number,
    time: (b: Record<string, number>) => number,
  ): number => time({ [key]: level }) / time({});
  const cost: [number, number, number] = [1e12, 1e12, 0];
  const building = (b: Record<string, number>) => buildTime(cost, { b }, U);
  const ship = (b: Record<string, number>) => unitTime({ cost }, { b }, U);
  const research = (b: Record<string, number>) => researchTime(cost, { b }, U);

  it('is the Bauzeit of the buildings at the Servitorenschmiede', () => {
    const effects = timeEffects(view(), 'robot');
    expect(effects.map((e) => e.label)).toEqual(['Gebäude-Bauzeit']);
    for (const level of [0, 1, 2, 10])
      expect(effects[0]!.at(level)).toBeCloseTo(
        factor('robot', level, building),
        12,
      );
    expect(effects[0]!.at(1)).toBeCloseTo(0.5, 9);
    expect(effects[0]).toMatchObject({ format: 'factor', cost: true });
  });

  it('is the Bauzeit of buildings and of the shipyard at the Machina-Schwarmhalle', () => {
    const effects = timeEffects(view(), 'nanite');
    expect(effects.map((e) => e.label)).toEqual([
      'Gebäude-Bauzeit',
      'Einheiten-Bauzeit',
    ]);
    for (const level of [0, 1, 3]) {
      expect(effects[0]!.at(level)).toBeCloseTo(
        factor('nanite', level, building),
        12,
      );
      expect(effects[1]!.at(level)).toBeCloseTo(
        factor('nanite', level, ship),
        12,
      );
    }
    expect(effects[0]!.at(3)).toBeCloseTo(1 / 8, 9);
  });

  it('is the time of the shipyard at the Schiffsschmiede and the research time at the Scholarium', () => {
    const yard = timeEffects(view(), 'yard');
    expect(yard.map((e) => e.label)).toEqual(['Einheiten-Bauzeit']);
    expect(yard[0]!.at(2)).toBeCloseTo(factor('yard', 2, ship), 12);
    const lab = timeEffects(view(), 'lab');
    expect(lab.map((e) => e.label)).toEqual(['Forschungszeit']);
    expect(lab[0]!.at(3)).toBeCloseTo(factor('lab', 3, research), 12);
    expect(lab[0]!.at(3)).toBeCloseTo(0.25, 9);
  });

  it('is the time without the building at level 0, and none for any other entry', () => {
    const v = view();
    for (const key of Object.keys(BUILD)) {
      for (const e of timeEffects(v, key))
        expect(e.at(0), key).toBeCloseTo(1, 12);
    }
    for (const key of ['metal', 'solar', 'smetal'])
      expect(timeEffects(v, key), key).toEqual([]);
    for (const key of Object.keys(RES))
      expect(timeEffects(v, key), key).toEqual([]);
    expect(timeEffects(v, 'nothing')).toEqual([]);
  });

  it('does not depend on the speed of the universe', () => {
    const v = view();
    const fast = {
      ...v,
      s: { ...v.s, cfg: { ...v.s.cfg, speed: 50 } },
    };
    expect(timeEffects(fast, 'robot')[0]!.at(3)).toBeCloseTo(
      timeEffects(v, 'robot')[0]!.at(3),
      9,
    );
  });
});
