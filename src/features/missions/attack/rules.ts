// Sturmangriff: a battle at a foreign planet; the only mission whose ships
// the defender sees coming.
import type { SendError, TargetKind } from '../../../core/missions.ts';

export const order = 10;
export const target: TargetKind = 'foreign';
export const cargo = true;
export const returns = true;
export const visible = true;
export const silent = false;
/** No check of its own beyond the target kind. */
export const canSend = (): SendError | undefined => undefined;
