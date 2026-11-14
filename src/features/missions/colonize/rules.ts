// Landnahme: a Kolonistenarche founds a colony at a free position; the other
// ships fly back.
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';

export const order = 40;
export const target: TargetKind = 'free';
export const cargo = true;
export const returns = true;
export const visible = false;
export const silent = false;
/** A colony needs a Kolonistenarche in the fleet. */
export const canSend = (fleet: SendFleet): SendError | undefined =>
  fleet.ships.colony ? undefined : 'noColonyShip';
