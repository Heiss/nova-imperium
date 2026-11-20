// The input of the actions of the guild chat (#317); see ../actions.ts.
import { input } from '../action-input.ts';

export const actionInputs = {
  sendGuildChat: input<{ text: string }>(),
  deleteGuildChat: input<{ id: number }>(),
  seeGuildChat: input<{ id: number }>(),
};
