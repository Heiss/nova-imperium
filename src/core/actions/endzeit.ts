// The input of the actions of the Endzeit (#317); see ../actions.ts.
import { input } from '../action-input.ts';

export const actionInputs = {
  endzeit: input<{ minutes: string | number }>(),
};
