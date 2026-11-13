import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 120;
export const def: ShipFields = {
  cost: [0, 1000, 0],
  atk: 0.01,
  sh: 0.01,
  cargo: 0,
  speed: 100000000,
  fuel: 1,
  drive: 'comb',
  req: {
    b: {
      yard: 3,
    },
    r: {
      comb: 3,
      spy: 2,
    },
  },
};
