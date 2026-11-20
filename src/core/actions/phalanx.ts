// The input of the actions of the Auspex-Phalanx (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  scan: input<{ target: Attr }>(),
};
