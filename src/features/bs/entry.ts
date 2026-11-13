import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 70;
export const def: ShipFields = {
  cost: [45000, 15000, 0],
  atk: 1000,
  sh: 200,
  cargo: 1500,
  speed: 10000,
  fuel: 500,
  drive: 'hdrive',
  req: {
    b: {
      yard: 7,
    },
    r: {
      hdrive: 4,
    },
  },
};
