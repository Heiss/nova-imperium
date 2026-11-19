// Halten (#55, okf/features/holding-acs.md): a fleet flies to the planet of
// an ally, stays there for the holding time chosen at the launch and defends
// it with its owner, then flies home. Who counts as an ally is the admin's
// setting of the round (Q2); at most four players and 15 fleets hold at one
// planet (classic).
import { holdLimitError } from '../../../core/holding.ts';
import type {
  SendError,
  SendFleet,
  SendTarget,
  TargetKind,
} from '../../../core/missions.ts';

export const order = 70;
export const target: TargetKind = 'ally';
export const cargo = true;
export const returns = true;
export const silent = false;
export const alertsGuild = false;
export const holds = true;
/**
 * The owner of the planet must be an ally, and the planet must have room:
 * the limits of players and fleets that hold there.
 */
export function canSend(
  fleet: SendFleet,
  to: SendTarget,
): SendError | undefined {
  const owner = to.planet?.owner;
  if (owner === undefined || !to.ally?.(owner)) return 'notAlly';
  return holdLimitError(fleet.owner, to.holding?.() ?? []);
}
