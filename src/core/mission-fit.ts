// The missions that fit a target (#253; owner, 2026-11-16 and 2026-11-17):
// the fleet form offers only these, hidden and not disabled. The check is the
// pure `fitError` of src/core/missions.ts, the same the server runs when a
// fleet is sent (the target kind of each mission's rules), so browser and
// server cannot disagree. What the browser cannot know stays offered and the
// server refuses it as before: the noob protection and the vacation of
// another player, and who is an ally for a Halten.
import {
  type FitFleet,
  FLEET_MISSIONS,
  fitError,
  missionRules,
  type SendTarget,
} from './missions.ts';
import type { Mission } from './types.ts';

/**
 * What the browser knows of the target: the place there, a Trümmerfeld, a
 * moon, a lock, the expedition position, and the rules of the round, which
 * hide a mission that is off (#440).
 */
export type FitTarget = Pick<
  SendTarget,
  'planet' | 'debris' | 'moon' | 'locked' | 'expedition' | 'round'
>;

/**
 * The missions of the fleet form that fit the target, in the order of the
 * form. A Trümmerfeld adds the Bergung to what fits the planet or the free
 * position there (owner, 2026-11-17); the start planet as the target offers
 * no mission at all (owner, 2026-11-17).
 */
export function missionsFor(fleet: FitFleet, target: FitTarget): Mission[] {
  if (target.planet?.id === fleet.from) return [];
  const known = knownTarget(target);
  return FLEET_MISSIONS.filter(
    (m) => fitError(missionRules(m)!, fleet, known) === undefined,
  );
}

/** The browser knows neither the protection nor the vacation of another player. */
const knownTarget = (target: FitTarget): SendTarget => ({
  ...target,
  protects: () => false,
  vacation: () => false,
});

/**
 * Whether a button for the mission at the target is offered (#95, the
 * Sternenkarte): the target fits (`missionsFor`), as in the list of the fleet
 * form. The ships are not asked (owner, 2026-11-21): the Mondbruch shows at
 * every foreign moon, and the fleet form refuses a send without a
 * Weltenbrecher.
 */
export const canOffer = (
  mission: Mission,
  fleet: FitFleet,
  target: FitTarget,
): boolean => missionsFor(fleet, target).includes(mission);
