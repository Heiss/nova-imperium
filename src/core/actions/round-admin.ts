// The input of the actions of closing and deleting a round (#317); see ../actions.ts.
import { input, type None } from '../action-input.ts';

export const actionInputs = {
  closeRound: input<None>(),
  deleteRound: input<{ round: number }>(),
};
