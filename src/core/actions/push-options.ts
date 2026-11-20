// The input of the actions of the push settings (#317); see ../actions.ts.
import { input } from '../action-input.ts';
import type { PushTopic } from '../push.ts';

export const actionInputs = {
  pushOptions: input<{ off: PushTopic[] }>(),
};
