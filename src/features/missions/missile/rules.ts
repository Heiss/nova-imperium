// Raketenangriff (#54, okf/features/missiles.md): Orbitalraketen from the
// Raketenkrypta of a planet at a foreign planet or moon. They are launched
// in the Sternenkarte, not from the fleet form, take no fleet slot, cannot
// be recalled and do not come back [V]. The defender sees them coming like
// a foreign fleet (owner, 2026-11-17): through the foreign fleet view of
// src/server/game/state.ts (`foreignView`), where the thresholds of the
// Auspex-Lehre of #228 apply to every foreign fleet; the missiles of the
// flight count as its ships.
// The checks of the launch are `launchError` of src/core/missiles.ts.
import type { Launch, SendError, TargetKind } from '../../../core/missions.ts';

export const order = 90;
export const target: TargetKind = 'foreign';
export const cargo = false;
export const returns = false;
export const silent = false;
export const alertsGuild = false;
export const launch: Launch = 'missiles';
/** Never sent as a fleet: the launch checks its missiles itself. */
export const canSend = (): SendError | undefined => undefined;
