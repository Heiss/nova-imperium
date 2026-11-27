// „Optionen“, the data of the box of „Keine Wachen annehmen“ (#440, 230b).
import type { OptionsState } from './state.ts';

/** The part of the page the box shows. */
export interface HoldPart {
  /** Whether the player takes no holds of other players. */
  refused: boolean;
}

/** The option as the server keeps it; off until the state says otherwise. */
export const holdPart = ({ s }: OptionsState): HoldPart => ({
  refused: s.holdsRefused === true,
});
