// The input of the actions of the marketplace (#317); see ../actions.ts.
import { input } from '../action-input.ts';
import type { Res } from '../market.ts';

export const actionInputs = {
  trade: input<{ give: Res; get: Res; amount: number | null }>(),
};
