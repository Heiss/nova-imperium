// Planet fields (issue #51), used by the server and the browser: a planet has
// ⌊(diameter / 1000)²⌋ fields, every building level takes one, the extra
// fields of the universe and the levels of a building with `fields`
// (Weltenschmiede) add to them. Planets from before the fields have no limit.
import type { Rng } from './battle.ts';
import { BUILD } from './catalog.ts';
import type { Planet, Universe } from './types.ts';

/** The home planet always has 163 fields (owner, 2026-11-13). */
export const HOME_DIAMETER = 12800;

/**
 * Fields of a colony per position 1 to 15, the wiki table (owner,
 * 2026-11-13); positions 16 to 20 use the range of position 15.
 */
const RANGES: readonly (readonly [number, number])[] = [
  [96, 172],
  [104, 176],
  [112, 182],
  [118, 208],
  [133, 232],
  [146, 242],
  [152, 248],
  [156, 252],
  [150, 246],
  [142, 232],
  [136, 210],
  [125, 186],
  [114, 172],
  [100, 168],
  [90, 164],
];

/** ⌊(diameter / 1000)²⌋, in whole numbers. */
export const fieldsOf = (diameter: number): number =>
  Math.floor((diameter * diameter) / 1e6);

/** The smallest diameter in km that has `fields` fields. */
export const minDiameter = (fields: number): number =>
  Math.ceil(Math.sqrt(fields * 1e6));

/** The range of fields of a colony at `position`. */
export function fieldRange(position: number): { min: number; max: number } {
  const i = Math.min(Math.max(position, 1), RANGES.length) - 1;
  const [min, max] = RANGES[i]!;
  return { min, max };
}

/**
 * The diameter of a new colony: its fields are chosen at random in the range
 * of the position, then the diameter at random among those with that many.
 */
export function colonyDiameter(position: number, rng: Rng): number {
  const { min, max } = fieldRange(position);
  const fields = min + Math.floor(rng() * (max - min + 1));
  const lo = minDiameter(fields);
  return lo + Math.floor(rng() * (minDiameter(fields + 1) - lo));
}

/** One field per building level. */
export const usedFields = (p: Pick<Planet, 'b'>): number =>
  Object.values(p.b).reduce((sum, level) => sum + level, 0);

/** The fields a planet has, or null for a planet without a limit. */
export function maxFields(
  p: Pick<Planet, 'b' | 'diameter' | 'unlimited'>,
  u: Pick<Universe, 'extraFields'>,
): number | null {
  if (p.unlimited) return null;
  const added = Object.entries(p.b).reduce(
    (sum, [key, level]) => sum + (BUILD[key]?.fields ?? 0) * level,
    0,
  );
  return fieldsOf(p.diameter) + u.extraFields + added;
}

/** Whether no field is free for another building level. */
export function fieldsFull(
  p: Pick<Planet, 'b' | 'diameter' | 'unlimited'>,
  u: Pick<Universe, 'extraFields'>,
): boolean {
  const max = maxFields(p, u);
  return max !== null && usedFields(p) >= max;
}
