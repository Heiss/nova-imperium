// Mondbruch (#95, okf/features/moons.md; owner, 2026-11-13): a fleet with at
// least one Weltenbrecher fights at a foreign moon like a Sturmangriff and,
// after a won battle, may break the moon. The other ships fly along and
// fight.
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';

export const order = 80;
export const target: TargetKind = 'foreignMoon';
export const cargo = true;
export const returns = true;
export const silent = false;
/** A launch at a member alerts the guild like an attack (owner, 2026-11-16). */
export const alertsGuild = true;
export const holds = false;
/** A Mondbruch needs a Weltenbrecher in the fleet. */
export const canSend = (fleet: SendFleet): SendError | undefined =>
  fleet.ships.dstar ? undefined : 'noWorldbreaker';
