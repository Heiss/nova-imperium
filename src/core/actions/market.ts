// The input of the actions of the marketplace (#317); see ../actions.ts.
import { input } from '../action-input.ts';
import type { Res } from '../market.ts';

export const actionInputs = {
  // `price`: the price of the pair the player saw, in millionths of the base
  // (#406); a worse one now refuses the exchange.
  trade: input<{
    give: Res;
    get: Res;
    amount: number | null;
    price: number;
  }>(),
};
