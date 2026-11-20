// The input of the actions of the main planet (#317); see ../actions.ts.
import { input } from '../action-input.ts';

export const actionInputs = {
  mainPlanet: input<{ main: string }>(),
};
