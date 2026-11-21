// The input of the actions of the demolition (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  demolish: input<{ key: Attr }>(),
};
