// „Optionen“, the data of the box of „Keine Wachen annehmen“ (#440, 230b).
import { holdOpen } from '../../../core/holding.ts';
import { latestSaver } from '../latest-save.ts';
import type { OptionsState } from './state.ts';

/** The choice of the player while its save runs (CodeRabbit on #455); else none. */
export interface HoldChoice {
  holdChoice?: boolean;
}

/** The part of the page the box shows. */
export interface HoldPart {
  /** Whether the player takes no holds of other players. */
  refused: boolean;
  /** Whether „Wache stellen“ is on in the round: else the box is hidden. */
  offered: boolean;
}

/**
 * The option as shown: the player's pending choice while its save runs, else
 * as the server keeps it (off until the state says otherwise).
 */
export const shownRefused = (
  s: Pick<OptionsState['s'], 'holdsRefused'>,
  ui: HoldChoice,
): boolean => ui.holdChoice ?? s.holdsRefused === true;

/** The box as the page shows it. */
export const holdPart = ({ s, ui }: OptionsState): HoldPart => ({
  refused: shownRefused(s, ui),
  offered: holdOpen(s.round),
});

/** The box is shown while „Wache stellen“ is on (okf/ops/feature-switches.md). */
export const holdShown = (page: HoldPart): boolean => page.offered;

/**
 * Saves „Keine Wachen annehmen“ one value at a time, the newest click last
 * (`latestSaver`), as `pushSaver` does for the push kinds: the choice shows at
 * once and stays shown while a save runs, so an earlier answer never shows
 * the older value; when the last save returns, saved or not, the page shows
 * the server's option again. Resolves when no save runs any more.
 */
export function holdSaver(
  choice: HoldChoice,
  save: (on: boolean) => Promise<unknown>,
): (on: boolean) => Promise<void> {
  // A value still waiting when the choice was forgotten with the player
  // (`client.forgetPlayer`, PR #469) is not sent.
  const saver = latestSaver((on: boolean) =>
    choice.holdChoice === undefined ? Promise.resolve() : save(on),
  );
  return async (on) => {
    choice.holdChoice = on;
    try {
      await saver(on);
    } finally {
      // Only the run of the newest click clears it.
      if (choice.holdChoice === on) choice.holdChoice = undefined;
    }
  };
}
