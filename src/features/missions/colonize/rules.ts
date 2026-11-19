// Landnahme: a Kolonistenarche founds a colony at a free position; the other
// ships fly back.
import { limitReached } from '../../../core/colony-limit.ts';
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';

export const order = 40;
export const target: TargetKind = 'free';
export const cargo = true;
export const returns = true;
export const silent = false;
export const alertsGuild = false;
export const holds = false;
/** The server counts a colony on its way against the limit of planets (#237). */
export const colonizes = true;
/**
 * A colony needs a Kolonistenarche in the fleet, and room under the limit
 * of planets of the round (#237): the planets the player owns and the
 * Landnahmen on their way out must stay below it.
 */
export function canSend(fleet: SendFleet): SendError | undefined {
  if (!fleet.ships.colony) return 'noColonyShip';
  const room = fleet.colonies?.();
  return room && limitReached(room.limit, room.count)
    ? 'colonyLimit'
    : undefined;
}
