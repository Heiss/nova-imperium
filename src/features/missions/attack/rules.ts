// Sturmangriff: a battle at a foreign planet. What the defender sees of its
// ships follows the Auspex-Lehre, as for every foreign fleet (#228, D2).
import type { SendError, TargetKind } from '../../../core/missions.ts';

export const order = 10;
export const target: TargetKind = 'foreign';
export const cargo = true;
export const returns = true;
export const silent = false;
export const alertsGuild = true;
export const holds = false;
/** No check of its own beyond the target kind. */
export const canSend = (): SendError | undefined => undefined;
