// Versorgungsflug: delivers its cargo to any planet and flies back.
import type { SendError, TargetKind } from '../../../core/missions.ts';

export const order = 20;
export const target: TargetKind = 'any';
export const cargo = true;
export const returns = true;
export const visible = false;
export const silent = false;
/** No check of its own beyond the target kind. */
export const canSend = (): SendError | undefined => undefined;
