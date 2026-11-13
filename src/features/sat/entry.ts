import type { ShipFields } from '../../core/catalog.ts';
import type { Produces } from '../../core/components/produces.ts';
import { satsEnergy } from '../../core/rates.ts';

export const kind = 'ship';
export const order = 130;
// Its level is the number of satellites on the planet (#46).
export const produces: Produces = {
  order: 50,
  e: (x) => satsEnergy(x.level, x.temp, x.pct),
};
export const def: ShipFields = {
  cost: [0, 2000, 500],
  atk: 1,
  sh: 1,
  cargo: 0,
  speed: 0,
  fuel: 0,
  drive: 'comb',
  req: {
    b: {
      yard: 1,
    },
  },
};
