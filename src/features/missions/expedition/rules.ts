// Expedition (#93, okf/features/expeditions.md; owner, 2026-11-16 and
// 2026-11-17): any ships fly to the expedition position of a system, the one
// after the last planet position, with at least level 1 of
// „Kreuzzugs-Kartografie“, stay there for hours of their own choice, and
// fly home with what the expedition brought. It takes a fleet slot and an
// expedition slot. No cargo [V]: finds fill the holds.
import { expeditionSlots, maxHoldHours } from '../../../core/expedition.ts';
import type {
  SendError,
  SendFleet,
  TargetKind,
} from '../../../core/missions.ts';
import type { Levels } from '../../../core/types.ts';

export const order = 100;
export const target: TargetKind = 'expedition';
export const cargo = false;
export const returns = true;
export const visible = false;
export const silent = false;
export const alertsGuild = false;

/** The level of the research, the one that unlocks the mission. */
const levelOf = (research: Levels | undefined): number => research?.expo ?? 0;

/** The most hours the fleet stays: the level of „Kreuzzugs-Kartografie“ (Q3). */
export const maxHold = (research: Levels): number =>
  maxHoldHours(levelOf(research));

/**
 * Without level 1 of the research the mission is not available; then as many
 * expeditions may fly at once as ⌊√level⌋ allows (Q3), counting the ones on
 * their way home.
 */
export const canSend = (fleet: SendFleet): SendError | undefined => {
  const level = levelOf(fleet.research);
  if (level < 1) return 'expeditionLocked';
  return (fleet.running ?? 0) >= expeditionSlots(level)
    ? 'expeditionSlots'
    : undefined;
};
