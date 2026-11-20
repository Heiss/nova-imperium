// The input of the actions of the vacation mode (#317); see ../actions.ts.
import { input, type None } from '../action-input.ts';

export const actionInputs = {
  startVacation: input<None>(),
  endVacation: input<None>(),
};
