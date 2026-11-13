import type { Consumes } from '../../core/components/consumes.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Produces } from '../../core/components/produces.ts';
import { grows } from '../../core/rates.ts';

export const kind = 'building';
export const order = 20;
export const leveled: Required<Leveled> = {
  cost: [48, 24, 0],
  f: 1.6,
};
export const produces: Produces = {
  order: 20,
  c: (x) => grows(20)(x) * x.f,
};
export const consumes: Consumes = {
  e: grows(10),
};
