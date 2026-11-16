// The Mondbruch (#95, okf/features/moons.md; owner, 2026-11-13, owiki.de
// „Mond“, section Zerstörung): after a won battle at a moon, or at an
// undefended one, two independent rolls follow. The moon breaks with
// min(100, (100 − √d) · √n) %, and the Weltenbrecher of the fleet are torn
// apart with √d / 2 %, d the diameter of the moon in km and n the
// Weltenbrecher of the fleet. Example: 4,000 km and one Weltenbrecher give
// 36.75 % and 31.6 %.
import type { Rng } from './battle.ts';

/** The chance in % that the moon breaks, at most 100. */
export const breakChance = (diameter: number, worldbreakers: number): number =>
  Math.min(100, (100 - Math.sqrt(diameter)) * Math.sqrt(worldbreakers));

/** The chance in % that the Weltenbrecher are lost by their own shot. */
export const lossChance = (diameter: number): number => Math.sqrt(diameter) / 2;

/** The outcome of the two rolls, as the battle report keeps it. */
export interface Moonbreak {
  /** The chance in % that the moon breaks. */
  chance: number;
  /** Whether the moon broke. */
  broken: boolean;
  /** The chance in % that the Weltenbrecher are lost. */
  loss: number;
  /** Whether the Weltenbrecher of the fleet are lost. */
  lost: boolean;
}

/**
 * The two independent rolls, the moon first, one draw each: a draw below
 * the chance hits.
 */
export function moonbreak(
  diameter: number,
  worldbreakers: number,
  rng: Rng,
): Moonbreak {
  const chance = breakChance(diameter, worldbreakers);
  const broken = rng() < chance / 100;
  const loss = lossChance(diameter);
  const lost = rng() < loss / 100;
  return { chance, broken, loss, lost };
}
