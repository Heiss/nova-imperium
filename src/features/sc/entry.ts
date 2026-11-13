import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 10;
export const def: ShipFields = {
  cost: [2000, 2000, 0],
  atk: 5,
  sh: 10,
  cargo: 5000,
  speed: 5000,
  fuel: 10,
  drive: 'comb',
  req: {
    b: {
      yard: 2,
    },
    r: {
      comb: 2,
    },
  },
};
