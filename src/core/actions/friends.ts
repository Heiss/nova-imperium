// The input of the actions of the buddy list (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  requestFriend: input<{ name: string }>(),
  answerFriend: input<{ uid: Attr; accept: boolean }>(),
  cancelFriend: input<{ uid: Attr }>(),
  removeFriend: input<{ uid: Attr }>(),
};
