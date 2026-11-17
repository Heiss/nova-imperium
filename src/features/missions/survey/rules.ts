// Vermessung (#190): only Spähschädel and no cargo, to a free position, with
// at least level 1 of „Auspex-Kartographie“; they come home without a report
// of their own unless recalled, like an Auspex-Erkundung.
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';

export const order = 70;
export const target: TargetKind = 'free';
export const cargo = false;
export const returns = true;
export const visible = false;
export const silent = true;
export const alertsGuild = false;
/** Without level 1 of the research the mission is not available (D2); then only Spähschädel fly. */
export const canSend = (fleet: SendFleet): SendError | undefined => {
  if (!fleet.research?.survey) return 'surveyLocked';
  return Object.keys(fleet.ships).some((k) => k !== 'probe')
    ? 'surveyProbesOnly'
    : undefined;
};
