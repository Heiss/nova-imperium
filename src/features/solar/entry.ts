import type { Leveled } from '../../core/components/leveled.ts';
import type { Produces } from '../../core/components/produces.ts';
import { grows } from '../../core/rates.ts';

export const kind = 'building';
export const order = 40;
export const leveled: Required<Leveled> = {
  cost: [75, 30, 0],
  f: 1.5,
};
export const produces: Produces = {
  order: 40,
  e: grows(20),
};
