import type { Consumes } from '../../core/components/consumes.ts';
import type { Leveled } from '../../core/components/leveled.ts';
import type { Produces } from '../../core/components/produces.ts';
import { growth, grows, tempFactor } from '../../core/rates.ts';

export const kind = 'building';
export const order = 30;
export const leveled: Required<Leveled> = {
  cost: [225, 75, 0],
  f: 1.5,
};
// The warmer the planet, the less it yields (tempFactor).
export const produces: Produces = {
  order: 30,
  d: (x) => 10 * growth(x.level) * tempFactor(x.temp) * (x.pct / 100) * x.f,
};
export const consumes: Consumes = {
  e: grows(20),
};
