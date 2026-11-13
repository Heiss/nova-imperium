import type { ShipFields } from '../../core/catalog.ts';

export const kind = 'ship';
export const order = 30;
export const def: ShipFields = {
  cost: [10000, 20000, 10000],
  atk: 50,
  sh: 100,
  cargo: 7500,
  speed: 2500,
  fuel: 1000,
  drive: 'impulse',
  req: {
    b: {
      yard: 4,
    },
    r: {
      impulse: 3,
    },
  },
};
