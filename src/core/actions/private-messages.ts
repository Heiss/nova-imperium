// The input of the actions of the private messages (#226, #317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  sendPrivateMessage: input<{ name: string; text: string }>(),
  readPrivateMessages: input<{ name: Attr }>(),
  deletePrivateMessage: input<{ id: number }>(),
  deletePrivateConversation: input<{ name: Attr }>(),
  reportPrivateMessage: input<{ id: number }>(),
  blockPlayer: input<{ name: string }>(),
  unblockPlayer: input<{ name: Attr }>(),
  privateMessageOptions: input<{ friendsOnly: boolean }>(),
};
