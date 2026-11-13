// The component `combat` (okf/architecture/patterns.md, sections 1, 5 and
// 12; #114): an entry that fights, every ship and defense. It keeps the
// names of version 1, attack `atk`, shield `sh` and rapid fire `rf`; the
// hull is not stored, it follows from the cost of the entry's `unit`
// (owner, 2026-11-13). Only this module reads the component; the battle
// asks it for the strength of a piece and the rapid fire of a pair.
import type { Unit } from './unit.ts';

export interface Combat {
  /** Attack of one piece before the weapons research. */
  atk: number;
  /** Shield of one piece before the shield research. */
  sh: number;
  /** Rapid fire against other entries, by their key. */
  rf?: Record<string, number>;
  /**
   * An easy target: every ship that is not easy itself has rapid fire
   * `EASY_RAPID_FIRE` against it, unless its `rf` names it (owner,
   * 2026-11-13; version 1 had the Spähschädel and the Sonnenreliquiar).
   */
  easy?: true;
}

/** Rapid fire of a ship against an easy target, as in version 1. */
export const EASY_RAPID_FIRE = 5;

/** An entry with its `unit` and `combat` components. */
export interface Fighter {
  kind: 'ship' | 'defense';
  unit: Unit;
  combat: Combat;
}

/** Hull, shield and attack of one piece, before the research bonus. */
export const strength = (
  f: Fighter,
): { hull: number; shield: number; attack: number } => ({
  hull: (f.unit.cost[0] + f.unit.cost[1]) / 10,
  shield: f.combat.sh,
  attack: f.combat.atk,
});

/**
 * Rapid fire of `attacker` against the entry `target` (key) with the
 * components `t`: the chance to shoot again is (r - 1) / r. An unknown
 * entry has none.
 */
export function rapidFire(
  attacker: Fighter | undefined,
  target: string,
  t: Fighter | undefined,
): number {
  const own = attacker?.combat.rf;
  // Only an own entry counts: `toString` or `constructor` is no target.
  const rf = own && Object.hasOwn(own, target) ? own[target] : undefined;
  if (rf) return rf;
  const ship = attacker?.kind === 'ship' && !attacker.combat.easy;
  return ship && t?.combat.easy ? EASY_RAPID_FIRE : 1;
}
