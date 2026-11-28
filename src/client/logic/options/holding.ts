// „Optionen“, the data of the box of „Keine Wachen annehmen“ (#440, 230b).
import { holdOpen } from '../../../core/holding.ts';
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface HoldPart {
  /** Whether the player takes no holds of other players. */
  refused: boolean;
  /** Whether „Wache stellen“ is on in the round: else the box is hidden. */
  offered: boolean;
}

/** The option as the server keeps it; off until the state says otherwise. */
export const holdPart = ({ s }: OptionsState): HoldPart => ({
  refused: s.holdsRefused === true,
  offered: holdOpen(s.round),
});

/** The box is shown while „Wache stellen“ is on (okf/ops/feature-switches.md). */
export const holdShown = (page: HoldPart): boolean => page.offered;
