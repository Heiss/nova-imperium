import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 40;
export const def: ShipFields = {
  cost: [3000, 1000, 0],
  atk: 50,
  sh: 10,
  cargo: 50,
  speed: 12500,
  fuel: 20,
  drive: 'comb',
  req: {
    b: {
      yard: 1,
    },
    r: {
      comb: 1,
    },
  },
};
