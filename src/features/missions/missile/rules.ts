// Raketenangriff (#54, okf/features/missiles.md): Orbitalraketen from the
// Raketenkrypta of a planet at a foreign planet or moon. They are launched
// in the Sternenkarte, not from the fleet form, take no fleet slot, cannot
// be recalled and do not come back [V]; the defender sees them coming [V].
// The checks of the launch are `launchError` of src/core/missiles.ts.
import type { Launch, SendError, TargetKind } from '../../../core/missions.ts';

export const order = 70;
export const target: TargetKind = 'foreign';
export const cargo = false;
export const returns = false;
export const visible = true;
export const silent = false;
export const alertsGuild = false;
export const launch: Launch = 'missiles';
/** Never sent as a fleet: the launch checks its missiles itself. */
export const canSend = (): SendError | undefined => undefined;
