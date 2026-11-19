// Moons (#53, okf/features/moons.md; owner, 2026-11-13 and 2026-11-14): the
// moon chance after a battle at a planet, its roll and the diameter of a new
// moon, and the name a moon shows. This is the moon step of the battle's
// consequences (okf/architecture/patterns.md, section 5), after the debris.
// A moon is a row of the planets with the kind `moon` (#119, O11).
import type { Rng } from './battle.ts';
import type { Debris } from './debris.ts';
import type { Planet } from './types.ts';

/** 1 % moon chance per 100,000 Adamant and Psikristall in the Trümmerfeld. */
export const PER_PERCENT = 100000;

/** The moon chance never exceeds 20 %. */
export const MAX_MOON_CHANCE = 20;

/** The least chance the admin can give a moon (owner, 2026-11-13: 1 to 20 %). */
export const MIN_MOON_CHANCE = 1;

/**
 * The moon chance in whole percent: ⌊debris / 100,000⌋, at most 20, counted
 * from the whole Trümmerfeld at the position after the battle.
 */
export const moonChance = (field: Debris): number =>
  Math.min(Math.floor((field.m + field.c) / PER_PERCENT), MAX_MOON_CHANCE);

/** One draw: whether a moon forms at a chance of `chance` %. */
export const formsMoon = (chance: number, rng: Rng): boolean =>
  rng() < chance / 100;

/**
 * The diameter of a new moon in km, by the owiki.de formula
 * ⌊√(x + 3 · chance) · 1000⌋ with x a whole number from 10 to 20, all
 * equally likely: 3,605 to 8,944 km.
 */
export function moonDiameter(chance: number, rng: Rng): number {
  const x = 10 + Math.floor(rng() * 11);
  return Math.floor(Math.sqrt(x + 3 * chance) * 1000);
}

/** A moon is always shown as „<Name> (Mond)“ (owner, 2026-11-14). */
export const placeName = (p: Pick<Planet, 'name' | 'kind'>): string =>
  p.kind === 'moon' ? `${p.name} (Mond)` : p.name;
