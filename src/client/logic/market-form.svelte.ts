// The state of the form of the marketplace (#171, #332): what the player chose
// and typed. The component Market binds it and features/market.ts reads it, so
// a redraw that mounts the page anew shows it again. A fresh render does not
// drop it (the draft of the marketplace was never dropped by one).
import type { Res } from '../../core/market.ts';
import { type Draft, fixed, newDraft } from './market.ts';

/** The draft of the open form; the view and its handlers share it. */
export const draft: Draft = $state(newDraft());

/** The player chose what to give; what to get is another resource then. */
export function chooseGive(give: Res): void {
  draft.give = give;
  draft.get = fixed(draft).get;
}
