import type { Consumes } from '../../core/components/consumes.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Produces } from '../../core/components/produces.ts';
import { grows } from '../../core/rates.ts';

export const kind = 'building';
export const order = 10;
export const leveled: Required<Leveled> = {
  cost: [60, 15, 0],
  f: 1.5,
};
export const produces: Produces = {
  order: 10,
  m: (x) => grows(30)(x) * x.f,
};
export const consumes: Consumes = {
  e: grows(10),
};
