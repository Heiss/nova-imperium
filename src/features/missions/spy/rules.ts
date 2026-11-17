// Auspex-Erkundung: only Spähschädel and no cargo, at a foreign planet; they
// come home without a report of their own unless recalled.
import { spyTechError } from '../../../core/espionage.ts';
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';

export const order = 30;
export const target: TargetKind = 'foreign';
export const cargo = false;
export const returns = true;
export const visible = false;
export const silent = true;
export const alertsGuild = false;
/**
 * Only Spähschädel fly to an Auspex-Erkundung, and only from espionage
 * technology 1 (#175, Q1).
 */
export const canSend = (fleet: SendFleet): SendError | undefined =>
  Object.keys(fleet.ships).some((k) => k !== 'probe')
    ? 'probesOnly'
    : spyTechError(fleet.research?.spy ?? 0);
