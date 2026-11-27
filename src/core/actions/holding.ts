// The input of the actions of „Wache stellen“ (#440); see ../actions.ts.
import { input } from '../action-input.ts';

export const actionInputs = {
  /** „Wegschicken“: the host sends the hold `id` away (230b, 231a). */
  sendAway: input<{ id: string }>(),
  /** „Keine Wachen annehmen“ on or off (230b). */
  holdOption: input<{ on: boolean }>(),
};
