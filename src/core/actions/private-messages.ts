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
  /** The page of messages before the message `before` of the same conversation (Q27). */
  olderPrivateMessages: input<{ before: number }>(),
  /** The newest page of the conversation with the player `name`, when the player opens it (Q32). */
  openPrivateConversation: input<{ name: Attr }>(),
  /** The newest page of the sent messages, or the page before the sent message `before` (Q33). */
  sentPrivateMessages: input<{ before?: number }>(),
};
