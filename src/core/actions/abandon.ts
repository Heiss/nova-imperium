// The input of the actions of the Kolonie aufgeben (#317); see ../actions.ts.
import { type Attr, input } from '../action-input.ts';

export const actionInputs = {
  abandon: input<{ target: Attr; created: number; password: string }>(),
};
