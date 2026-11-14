// Bergung (#45, owner, 2026-11-13): a fleet with at least one Bergungsbarke
// flies to a Trümmerfeld and brings home what its holds take.
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';

export const order = 60;
export const target: TargetKind = 'debris';
export const cargo = false;
export const returns = true;
export const visible = false;
export const silent = false;
/** A Bergung needs a Bergungsbarke in the fleet. */
export const canSend = (fleet: SendFleet): SendError | undefined =>
  fleet.ships.recycler ? undefined : 'noRecycler';
