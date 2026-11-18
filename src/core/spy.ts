// The rules of the Auspex-Erkundung that both the server and the browser
// read (#285, the direction of #214): what a report shows (the chance of the
// Auspex-Abwehr is in src/core/espionage.ts, #175). The arrival of the mission
// (src/features/missions/spy/arrive.server.ts) and the Lexicanum use them.

/** What a part of a report holds: ships, defense, buildings, research. */
export type SpyPart = 'ships' | 'def' | 'b' | 'r';

/**
 * The Auspex-Wert from which a report shows a part; the resources are always
 * shown. In the order of the report.
 */
export const SPY_LEVELS: readonly (readonly [number, SpyPart])[] = [
  [2, 'ships'],
  [3, 'def'],
  [5, 'b'],
  [7, 'r'],
];

/**
 * The Auspex-Wert of a report: every Spähschädel counts one, the lead in the
 * Auspex-Lehre counts squared, a lag likewise against it.
 */
export function spyScore(probes: number, diff: number): number {
  return probes + Math.sign(diff) * diff * diff;
}

/** The parts a report with this Auspex-Wert shows. */
export const spyParts = (score: number): SpyPart[] =>
  SPY_LEVELS.filter(([min]) => score >= min).map(([, part]) => part);

/**
 * The fewest Spähschädel that show a part at a lead of `diff`: at least
 * one, since a mission needs a ship.
 */
export const probesFor = (min: number, diff: number): number =>
  Math.max(1, min - Math.sign(diff) * diff * diff);
