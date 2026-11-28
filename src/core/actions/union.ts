// The input of the actions of the attack unions (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  inviteUnion: input<{ id: Attr; name: string }>(),
  /** The leader aborts the planned start of his fleet (#478). */
  cancelPlan: input<{ id: Attr }>(),
};
