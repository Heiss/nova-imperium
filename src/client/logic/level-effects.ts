// What a level brings, for the level table of #187 (the overview of the
// lists and the article of the Lexicanum): the effects every entry has by a
// component of its own, computed from the rules of the core on the shown
// planet and universe. An entry that needs a rule of its own (fleet slots,
// the range of the Auspex-Phalanx, …) states it in the lexicon file of its
// folder; the lists read that through the Lexicanum (logic/level-overview.ts).
import { BUILD, PRODUCTION, STORAGE } from '../../core/catalog.ts';
import { buildTime, researchTime, unitTime } from '../../core/economy.ts';
import { capOf } from '../../core/components/storage.ts';
import { maxFields } from '../../core/fields.ts';
import type { Cost, Planet, Universe } from '../../core/types.ts';
import type { V } from '../views/common.ts';
import type { LevelEffect } from './level-table.ts';

/**
 * The headings of what a producer makes; a mine makes less without enough
 * energy, so its heading says what the rate assumes (owner, 2026-11-17).
 */
const MADE: readonly [string, string][] = [
  ['m', 'Adamant/h bei voller Energie'],
  ['c', 'Psikristall/h bei voller Energie'],
  ['d', 'Promethium/h bei voller Energie'],
  ['e', 'Energie'],
];

/** The heading of the energy a building needs ([V], #187). */
export const ENERGY_NEED = 'Energiebedarf';

/** The headings of what a consumer uses per hour ([V], #187). */
const USED: readonly [string, string][] = [
  ['e', ENERGY_NEED],
  ['m', 'Adamantverbrauch/h'],
  ['c', 'Psikristallverbrauch/h'],
  ['d', 'Promethiumverbrauch/h'],
];

/** What a rate function knows of the shown planet at a level, at full share. */
const ctx = (v: V, level: number) => ({
  level,
  pct: 100,
  temp: v.P.temp,
  research: v.R.research,
  u: v.s.cfg,
});

/**
 * What a producing building makes per hour at a level on the shown planet,
 * at full share and with enough energy: its own rate function (`produces`),
 * a resource times the universe speed as prod() adds it; undefined for any
 * other entry (a ship that produces has no levels).
 */
export function producerEffect(v: V, key: string): LevelEffect | undefined {
  const produces = PRODUCTION.find(
    (p) => p.key === key && p.kind === 'building',
  )?.produces;
  const first = produces && MADE.find(([res]) => produces[res as 'm']);
  if (!produces || !first) return undefined;
  const [res, label] = first as ['m' | 'c' | 'd' | 'e', string];
  return {
    label,
    at: (level) =>
      res === 'e'
        ? produces.e!(ctx(v, level))
        : produces[res]!({ ...ctx(v, level), f: 1 }) * v.s.cfg.speed,
  };
}

/** The capacity of a store at a level, or undefined for any other entry. */
export const storageEffect = (v: V, key: string): LevelEffect | undefined =>
  STORAGE.some((s) => s.key === key)
    ? { label: 'Lagerkapazität', at: (level) => capOf(level, v.s.cfg) }
    : undefined;

/**
 * The fields a building adds to its planet with its levels (`fields`, the
 * Weltenschmiede), as maxFields() counts them; undefined for any other
 * entry ([V], #187).
 */
export const fieldsEffect = (key: string): LevelEffect | undefined =>
  BUILD[key]?.fields
    ? {
        label: 'Zusätzliche Felder',
        at: (level) =>
          maxFields(
            { b: { [key]: level }, diameter: 0, unlimited: false },
            { extraFields: 0 },
          )!,
      }
    : undefined;

/**
 * What a building uses per hour at a level: its energy need and the
 * resources it burns (`consumes`), each as a column that costs; none for an
 * entry that uses nothing (#187).
 */
export function useEffects(v: V, key: string): LevelEffect[] {
  const consumes = PRODUCTION.find(
    (p) => p.key === key && p.kind === 'building',
  )?.consumes;
  if (!consumes) return [];
  return USED.flatMap(([res, label]) => {
    const rate = consumes[res as 'e'];
    if (!rate) return [];
    return [
      {
        label,
        cost: true as const,
        at: (level: number) => rate(ctx(v, level)),
      },
    ];
  });
}

/** A cost big enough that the minimum time never applies. */
const PROBE: Cost = [1e12, 1e12, 0];

/** The planet with one building at a level and no other. */
const alone = (key: string, level: number): Pick<Planet, 'b'> => ({
  b: { [key]: level },
});

/**
 * The time factors: how much a level of a building shortens the building
 * time, the time of a ship or defense order, or the research time, as the
 * factor on the time without it (Servitorenschmiede, Machina-Schwarmhalle,
 * Schiffsschmiede, Scholarium). The formulas of the core are asked with a
 * probe cost, so no rule is repeated here; none for a building that shortens
 * nothing, and none for research (#187).
 */
export function timeEffects(v: V, key: string): LevelEffect[] {
  if (!Object.hasOwn(BUILD, key)) return [];
  const u: Universe = v.s.cfg;
  const factors: readonly [string, (p: Pick<Planet, 'b'>) => number][] = [
    ['Gebäude-Bauzeit', (p) => buildTime(PROBE, p, u)],
    ['Einheiten-Bauzeit', (p) => unitTime({ cost: PROBE }, p, u)],
    ['Forschungszeit', (p) => researchTime(PROBE, p, u)],
  ];
  return factors.flatMap(([label, time]) => {
    const at = (level: number): number =>
      time(alone(key, level)) / time(alone(key, 0));
    return Math.abs(at(1) - 1) > 1e-9
      ? [{ label, at, format: 'factor' as const, cost: true as const }]
      : [];
  });
}
