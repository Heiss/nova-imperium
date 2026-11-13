import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 20;
export const def: ShipFields = {
  cost: [6000, 6000, 0],
  atk: 5,
  sh: 25,
  cargo: 25000,
  speed: 7500,
  fuel: 50,
  drive: 'comb',
  req: {
    b: {
      yard: 4,
    },
    r: {
      comb: 6,
    },
  },
};
