// Counter-espionage by the classic rules (#175,
// okf/features/espionage-defense.md). The owner's decisions: the chance
// follows the owiki approximation (D1) and is drawn at random from 0 up to
// its maximum for every spying (D2); its result is a percent, capped at
// 100 % (owner, 2026-11-17; owiki „Spionagebericht“, section
// „Spionageabwehr“, oldid=77679); the target's ships multiply it by
// (1 + ships / 100) (Q2); spying needs espionage technology 1 (Q1), and a
// target at level 0 gives 0 % (Q1b).

/** The espionage technology a player needs to spy (owner, 2026-11-16, Q1). */
export const SPY_MIN_TECH = 1;

/** Why a player may not spy, as a code; the server words it. */
export type SpyTechError = 'noSpyTech';

/** Whether the espionage technology of the spy is too low to spy (Q1). */
export const spyTechError = (spy: number): SpyTechError | undefined =>
  spy < SPY_MIN_TECH ? 'noSpyTech' : undefined;

/** What the chance depends on: the probes and the target's stationed ships, both technologies. */
export interface CounterInput {
  probes: number;
  /** The ships stationed at the target, satellites and probes included. */
  ships: number;
  /** The espionage technology of the target's owner. */
  target: number;
  /** The espionage technology of the spy. */
  spy: number;
}

/**
 * The highest counter-espionage chance in percent:
 * (probes / 4) · (target tech / spy tech) · (1 + ships / 100), at most 100.
 * A target at level 0 gives 0 (Q1b). A spy below level 1, which only a
 * fleet sent before Q1 can be, counts as a ratio without bound, so 100 [V].
 */
export function counterMax({
  probes,
  ships,
  target,
  spy,
}: CounterInput): number {
  if (target <= 0 || probes <= 0) return 0;
  if (spy <= 0) return 100;
  return Math.min(100, (probes / 4) * (target / spy) * (1 + ships / 100));
}

/** The chance of one spying, drawn at random from 0 up to the maximum (D2). */
export const counterChance = (max: number, rng: () => number): number =>
  rng() * max;

/** Whether the probes are detected at a chance in percent. */
export const detected = (chance: number, rng: () => number): boolean =>
  rng() * 100 < chance;

/** The chance as the reports show it: whole percent, rounded (owiki). */
export const shownChance = (chance: number): number => Math.round(chance);
