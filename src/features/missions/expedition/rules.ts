// Expedition (#93, okf/features/expeditions.md; owner, 2026-11-16 and
// 2026-11-17): any ships fly to the expedition position of a system, the one
// after the last planet position, with at least level 1 of
// „Kreuzzugs-Kartografie“, stay there for hours of their own choice, and
// fly home with what the expedition brought. It takes a fleet slot and an
// expedition slot. No cargo [V]: finds fill the holds.
import {
  expeditionLevel,
  expeditionSlots,
  maxStayHours,
} from '../../../core/expedition.ts';
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';
import type { Levels } from '../../../core/types.ts';

export const order = 110;
export const target: TargetKind = 'expedition';
export const cargo = false;
export const returns = true;
export const silent = false;
export const alertsGuild = false;
/** It stays at its position, but it is no Halten: it defends nothing and burns no fuel for the stay (`maxStay`). */
export const holds = false;

/**
 * The most hours the fleet stays: the level of „Kreuzzugs-Kartografie“ times
 * the hours per level of the round (Q3; owner, 2026-11-19), 1 by default.
 */
export const maxStay = (research: Levels, hoursPerLevel = 1): number =>
  maxStayHours(expeditionLevel(research), hoursPerLevel);

/**
 * Without level 1 of the research the mission is not available; then as many
 * expeditions may fly at once as ⌊√level⌋ and the extra places of the round
 * allow (Q3), counting the ones on their way home.
 */
export const canSend = (fleet: SendFleet): SendError | undefined => {
  const level = expeditionLevel(fleet.research);
  if (level < 1) return 'expeditionLocked';
  return (fleet.running ?? 0) >= expeditionSlots(level, fleet.extraSlots)
    ? 'expeditionSlots'
    : undefined;
};
