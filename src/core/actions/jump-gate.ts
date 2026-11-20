// The input of the actions of the Warp-Tor (#317); see ../actions.ts.
import { input } from '../action-input.ts';
import type { Levels } from '../types.ts';

export const actionInputs = {
  jump: input<{ to: string | undefined; ships: Levels }>(),
};
