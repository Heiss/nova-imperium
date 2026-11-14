// Verlegung: ships and cargo stay at another own planet for good (#129).
import type { SendError, TargetKind } from '../../../core/missions.ts';

export const order = 50;
export const target: TargetKind = 'own';
export const cargo = true;
export const returns = false;
export const visible = false;
export const silent = false;
/** No check of its own beyond the target kind. */
export const canSend = (): SendError | undefined => undefined;
