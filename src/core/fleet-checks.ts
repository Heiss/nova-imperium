// The checks of `send` and `recall` beside `sendError` (#214, patterns,
// section 7): pure functions that return the code of the first refusal in
// the order the server has always checked, or null. The server gathers the
// values (the ships picked from the planet, the used and the free slots, the
// cargo cut to the stock, the fuel) and words the codes (`FLEET_ERROR` in
// server/game/fleet-actions.ts); the target and the mission stay
// `sendError` of missions.ts, which the server asks between `startError`
// and the rest. The browser keeps its own hints (findings F11, F13 and F14
// of okf/architecture/action-checks.md stay).
import { canFly } from './catalog.ts';
import { capacity, countUnits } from './flight.ts';
import { dueAt, isHoldHours } from './holding.ts';
import {
  isFleet,
  launchOf,
  type MissionRules,
  missionRules,
} from './missions.ts';
import type { Fleet, Levels, Resources } from './types.ts';

/**
 * Why a fleet cannot start, before its target is asked: no mission of the
 * fleet form, a ship that cannot fly, no ships, or all slots used.
 */
export type StartError = 'mission' | 'stationary' | 'noShips' | 'slots';

/**
 * `send`, first: a mission that starts as a fleet (missiles start from the
 * silo, #54), only ships that can fly, at least one ship, a free slot.
 * `ships` are the ships picked from the planet, `used` the slots in use.
 */
export function startError(
  mission: string,
  ships: Levels,
  used: number,
  slots: number,
): StartError | null {
  const rules = missionRules(mission);
  if (!rules || launchOf(rules) !== 'fleet') return 'mission';
  if (!Object.keys(ships).every(canFly)) return 'stationary';
  if (!countUnits(ships)) return 'noShips';
  return used >= slots ? 'slots' : null;
}

/** `send`, after the target: a Halten needs one of the holding times (#55). */
export const holdTimeError = (
  rules: Pick<MissionRules, 'holds'>,
  hours: unknown,
): 'holdTime' | null =>
  rules.holds && !isHoldHours(hours) ? 'holdTime' : null;

/** `send`, after the holding time: the stay chosen at most the hours allowed (#93). */
export const stayError = (chosen: number, most: number): 'stay' | null =>
  chosen > most ? 'stay' : null;

/** Why the load cannot start: more than the hold, or too little Promethium. */
export type CargoError = 'hold' | 'fuel';

/**
 * `send`, last: the cargo within the hold of the ships, then the Promethium
 * of the planet for the fuel and the Promethium loaded.
 */
export function cargoError(
  ships: Levels,
  cargo: Resources,
  promethium: number,
  fuel: number,
): CargoError | null {
  if (cargo.m + cargo.c + cargo.d > capacity(ships)) return 'hold';
  return promethium < fuel + cargo.d ? 'fuel' : null;
}

/**
 * Whether a fleet can still be called back at `t`: on its way out before its
 * arrival, or while it holds before the end of its holding time (#55).
 */
export const recallable = (
  f: Pick<Fleet, 'state' | 'arr' | 'ret' | 'hold'>,
  t: number,
): boolean => (f.state === 'out' || f.state === 'hold') && dueAt(f) > t;

/** Why a fleet cannot be called back: gone (or no own fleet), or the gift. */
export type RecallError = 'gone' | 'gift';

/**
 * `recall`: an own fleet that can still be called back at `t`, not the gift
 * of the „Endzeit“ (#161), and no missiles (#54).
 */
export function recallError(
  f:
    | Pick<
        Fleet,
        'owner' | 'state' | 'arr' | 'ret' | 'hold' | 'gift' | 'mission'
      >
    | null
    | undefined,
  owner: string,
  t: number,
): RecallError | null {
  if (!f || f.owner !== owner || !recallable(f, t)) return 'gone';
  if (f.gift) return 'gift';
  return isFleet(f) ? null : 'gone';
}
