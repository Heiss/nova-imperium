// What the open Runden-Rewind remembers while the page is mounted anew (a
// fresh render of „Optionen“ or „Admin“, a refresh of the state): the card
// that is shown and whether the automatic play runs (#235, view G). The
// browser never starts the play by itself: it begins on the first card and
// stands still until the player asks for it.
import { stepIndex } from './round-rewind.ts';

export const rewindUi = $state({ index: 0, playing: false });

/** Back to the first card, standing still: a Rewind was opened. */
export function resetRewind(): void {
  rewindUi.index = 0;
  rewindUi.playing = false;
}

/**
 * Turns `step` cards. The player's own turn (`byPlay` false) pauses the
 * automatic play; the play stops by itself at the last card.
 */
export function turnRewind(step: number, count: number, byPlay = false): void {
  rewindUi.index = stepIndex(rewindUi.index, step, count);
  if (!byPlay || rewindUi.index >= count - 1) rewindUi.playing = false;
}

/** The button „Automatisch abspielen“, „Pause“ and „Noch einmal abspielen“ (from the first card on the last). */
export function togglePlay(count: number): void {
  if (rewindUi.playing) {
    rewindUi.playing = false;
    return;
  }
  if (rewindUi.index >= count - 1) rewindUi.index = 0;
  rewindUi.playing = count > 1;
}
