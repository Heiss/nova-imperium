// The input of the actions of the attack unions (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  openUnion: input<{ id: Attr }>(),
  inviteUnion: input<{ id: Attr; name: string }>(),
};
